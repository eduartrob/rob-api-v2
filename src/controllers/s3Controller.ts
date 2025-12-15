import { uploadImageProfile, generatePresignedUrl, uploadAppIcon, uploadAppScreenshot, uploadAppApk, deleteFileFromS3 } from "../services/fileService";
import { prisma } from "../config/db";
import type { Multer } from "multer";

type MulterFile = Express.Multer.File;

interface Screenshot {
  url: string;
  key: string;
}

function cleanUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.origin + parsedUrl.pathname;
  } catch (e) {
    const errorMessage = (e instanceof Error) ? e.message : String(e);
    console.warn(`Invalid URL for cleaning: ${url}. Error: ${errorMessage}`);
    return url;
  }
}

export class S3Controller {
  async getAppFilesByAppId(appId: string): Promise<any> {
    const appFileDoc = await prisma.appFile.findUnique({
      where: { appId }
    });

    if (!appFileDoc) {
      throw new Error("App files not found for this application ID.");
    }

    const signedIconUrl = appFileDoc.iconKey ? await generatePresignedUrl(appFileDoc.iconKey) : null;
    const signedAppFileUrl = appFileDoc.appFileKey ? await generatePresignedUrl(appFileDoc.appFileKey) : null;

    const screenshots = (appFileDoc.screenshots as unknown) as Screenshot[];
    const signedScreenshotUrls = await Promise.all(
      screenshots.map(async (screenshot: Screenshot) => {
        return screenshot.key ? await generatePresignedUrl(screenshot.key) : null;
      })
    );

    return {
      message: "Application files retrieved successfully.",
      appFiles: {
        appId: appFileDoc.appId,
        iconUrl: signedIconUrl,
        appFileUrl: signedAppFileUrl,
        appFileSize: appFileDoc.appFileSize,
        screenshots: signedScreenshotUrls.filter(url => url !== null),
        uploadedAt: appFileDoc.uploadedAt,
      },
    };
  }

  async uploadImageProfile(file: MulterFile, userId: string) {
    if (!file) {
      throw new Error("file-required");
    }
    const result = await uploadImageProfile(file, userId);

    const savedFile = await prisma.userFile.create({
      data: {
        userId: userId,
        key: result.Key || '',
        url: result.Location || '',
        contentType: file.mimetype,
      }
    });

    return {
      message: "Imagen de perfil subida con éxito",
      file: {
        id: savedFile.id,
        url: savedFile.url,
        contentType: savedFile.contentType,
        uploadedAt: savedFile.uploadedAt,
      },
    };
  }

  async uploadAppFiles(
    files: {
      icon?: MulterFile[],
      appFile?: MulterFile[],
      screenshots?: MulterFile[]
    },
    appId: string,
    userId: string,
    screenshotsToKeepUrls: string[]
  ) {
    let appFileDoc = await prisma.appFile.findUnique({
      where: { appId }
    });

    if (!appFileDoc) {
      if (!files.icon || files.icon.length === 0) {
        throw new Error("Icon file is required for new app file entry.");
      }
      if (!files.appFile || files.appFile.length === 0) {
        throw new Error("Application file (APK) is required for new app file entry.");
      }
      if (!files.screenshots || files.screenshots.length === 0) {
        throw new Error("At least one screenshot is required for new app file entry.");
      }

      // Create new AppFile record
      appFileDoc = await prisma.appFile.create({
        data: {
          appId,
          iconUrl: "",
          iconKey: "",
          appFileUrl: "",
          appFileKey: "",
          appFileSize: 0,
          screenshots: [],
        }
      });
    }

    let iconUrl = appFileDoc.iconUrl;
    let iconKey = appFileDoc.iconKey;
    let appFileUrl = appFileDoc.appFileUrl;
    let appFileKey = appFileDoc.appFileKey;
    let appFileSize = appFileDoc.appFileSize;

    // --- Upload and Update Icon ---
    if (files.icon && files.icon.length > 0) {
      const iconFile = files.icon[0];
      if (appFileDoc.iconKey) {
        try {
          await deleteFileFromS3(appFileDoc.iconKey);
          console.log(`Old icon deleted: ${appFileDoc.iconKey}`);
        } catch (deleteError: any) {
          console.warn(`Could not delete old icon (key: ${appFileDoc.iconKey}) for app ${appId}: ${deleteError.message}`);
        }
      }
      const iconUploadResult = await uploadAppIcon(iconFile, appId);
      if (!iconUploadResult.Location || !iconUploadResult.Key) {
        throw new Error("Icon upload failed: Location or Key is undefined.");
      }
      iconUrl = iconUploadResult.Location;
      iconKey = iconUploadResult.Key;
    }

    // --- Upload and Update Application File (APK) ---
    if (files.appFile && files.appFile.length > 0) {
      const appFile = files.appFile[0];
      if (appFileDoc.appFileKey) {
        try {
          await deleteFileFromS3(appFileDoc.appFileKey);
          console.log(`Old app file deleted: ${appFileDoc.appFileKey}`);
        } catch (deleteError: any) {
          console.warn(`Could not delete old app file (key: ${appFileDoc.appFileKey}) for app ${appId}: ${deleteError.message}`);
        }
      }
      const appFileUploadResult = await uploadAppApk(appFile, appId);
      if (!appFileUploadResult.Location || !appFileUploadResult.Key) {
        throw new Error("Application file upload failed: Location or Key is undefined.");
      }
      appFileUrl = appFileUploadResult.Location;
      appFileKey = appFileUploadResult.Key;
      appFileSize = appFile.size;
    }

    // --- Screenshots Logic ---
    const currentScreenshotsInDb = (appFileDoc.screenshots as unknown) as Screenshot[];
    const cleanedScreenshotsToKeepUrls = screenshotsToKeepUrls.map(url => cleanUrl(url));
    console.log("Cleaned screenshots to keep from client:", cleanedScreenshotsToKeepUrls);

    // Identify screenshots to delete from S3
    const screenshotsToDeleteFromS3 = currentScreenshotsInDb.filter(
      (screenshot: Screenshot) => {
        const cleanedDbUrl = cleanUrl(screenshot.url);
        const shouldDelete = !cleanedScreenshotsToKeepUrls.includes(cleanedDbUrl);
        if (shouldDelete) {
          console.log(`Marking for deletion: ${screenshot.url} (cleaned: ${cleanedDbUrl})`);
        }
        return shouldDelete;
      }
    );

    for (const screenshotToDelete of screenshotsToDeleteFromS3) {
      try {
        await deleteFileFromS3(screenshotToDelete.key);
        console.log(`Screenshot deleted from S3: ${screenshotToDelete.key}`);
      } catch (deleteError: any) {
        console.warn(`Could not delete old screenshot (key: ${screenshotToDelete.key}) for app ${appId}: ${deleteError.message}`);
      }
    }

    // Build the new screenshot list for DB
    const finalScreenshotsForDb: Screenshot[] = [];

    for (const screenshotUrlToKeep of cleanedScreenshotsToKeepUrls) {
      const existingScreenshot = currentScreenshotsInDb.find((s: Screenshot) => cleanUrl(s.url) === screenshotUrlToKeep);
      if (existingScreenshot) {
        finalScreenshotsForDb.push(existingScreenshot);
        console.log(`Keeping existing screenshot: ${existingScreenshot.url}`);
      }
    }

    // Upload new screenshots
    if (files.screenshots && files.screenshots.length > 0) {
      console.log(`Uploading ${files.screenshots.length} new screenshots.`);
      for (let i = 0; i < files.screenshots.length; i++) {
        const screenshot = files.screenshots[i];
        const screenshotUploadResult = await uploadAppScreenshot(screenshot, appId, i);
        if (!screenshotUploadResult.Location || !screenshotUploadResult.Key) {
          throw new Error(`Screenshot ${i} upload failed: Location or Key is undefined.`);
        }
        finalScreenshotsForDb.push({
          url: screenshotUploadResult.Location,
          key: screenshotUploadResult.Key,
        });
        console.log(`Added new screenshot: ${screenshotUploadResult.Location}`);
      }
    } else {
      console.log("No new screenshots to upload.");
    }

    // Update the AppFile record
    const updatedAppFile = await prisma.appFile.update({
      where: { appId },
      data: {
        iconUrl,
        iconKey,
        appFileUrl,
        appFileKey,
        appFileSize,
        screenshots: finalScreenshotsForDb as any,
        uploadedAt: new Date(),
      }
    });

    console.log("AppFile document saved successfully.");

    return {
      message: "Archivos de aplicación actualizados y guardados con éxito.",
      appFiles: {
        id: updatedAppFile.id,
        appId: updatedAppFile.appId,
        iconUrl: updatedAppFile.iconUrl,
        iconKey: updatedAppFile.iconKey,
        appFileUrl: updatedAppFile.appFileUrl,
        appFileKey: updatedAppFile.appFileKey,
        appFileSize: updatedAppFile.appFileSize,
        screenshots: updatedAppFile.screenshots,
        uploadedAt: updatedAppFile.uploadedAt,
      },
    };
  }

  async deleteAppFiles(appId: string, requestingUserId: string): Promise<{ message: string }> {
    // 1. Verify app ownership
    const app = await prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error("App not found.");
    }

    if (app.developerId !== requestingUserId) {
      throw new Error("Unauthorized: You do not have permission to delete files for this app.");
    }

    // 2. Find the associated AppFile document
    const appFileDoc = await prisma.appFile.findUnique({
      where: { appId }
    });

    if (!appFileDoc) {
      console.warn(`No AppFile document found for appId: ${appId}. No S3 files to delete.`);
      return { message: "No application files found for this app ID to delete." };
    }

    // 3. Delete files from S3
    const keysToDelete: string[] = [];
    const screenshots = (appFileDoc.screenshots as unknown) as Screenshot[];

    if (appFileDoc.iconKey) { keysToDelete.push(appFileDoc.iconKey); }
    if (appFileDoc.appFileKey) { keysToDelete.push(appFileDoc.appFileKey); }
    for (const screenshot of screenshots) {
      if (screenshot.key) { keysToDelete.push(screenshot.key); }
    }

    const deletePromises = keysToDelete.map(key => {
      return deleteFileFromS3(key).catch(error => {
        console.error(`Failed to delete S3 object with key ${key} for app ${appId}:`, error);
        return null;
      });
    });

    await Promise.all(deletePromises);
    console.log(`Attempted to delete ${keysToDelete.length} S3 objects for app ${appId}.`);

    // 4. Delete the AppFile document from the database
    await prisma.appFile.delete({
      where: { appId }
    });

    return { message: `Application files for app ID ${appId} deleted successfully.` };
  }

  async listUserFiles(userId: string) {
    const files = await prisma.userFile.findMany({
      where: { userId }
    });

    const filesWithUrl = await Promise.all(
      files.map(async (file) => {
        const signedUrl = await generatePresignedUrl(file.key);
        return {
          id: file.id,
          url: signedUrl,
          contentType: file.contentType,
          uploadedAt: file.uploadedAt,
        };
      })
    );

    return filesWithUrl;
  }
}
