/**
 * Migration Script: Encrypt Existing Text Content
 * 
 * This script encrypts all existing unencrypted text content in the database.
 * Run this if you have existing text-based Zaps that need to be encrypted.
 * 
 * ⚠️ IMPORTANT:
 * - Backup your database before running this script
 * - This script modifies data in place
 * - Make sure TEXT_ENCRYPTION_KEY is set in .env
 * 
 * Usage:
 *   npx ts-node src/utils/encrypt-existing-data.ts
 */

import prisma from "./prismClient";
import { encryptText, isEncrypted } from "./encryption";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

async function migrateTextContent() {
  console.log("=".repeat(70));
  console.log("Text Content Encryption Migration");
  console.log("=".repeat(70));
  console.log("\n⚠️  WARNING: This will encrypt all unencrypted text content");
  console.log("   Make sure you have a database backup before proceeding!\n");

  const confirmed = await askConfirmation(
    "Do you want to continue? (yes/no): "
  );

  if (!confirmed) {
    console.log("\n❌ Migration cancelled.");
    rl.close();
    return;
  }

  console.log("\n🔍 Scanning database for text-based Zaps...\n");

  try {
    // Find all Zaps with text content (TEXT, WORD, or PPT types)
    const zaps = await prisma.zap.findMany({
      where: {
        OR: [{ type: "TEXT" }, { type: "WORD" }, { type: "PPT" }],
        originalUrl: { not: null },
      },
    });

    console.log(`Found ${zaps.length} text-based Zaps`);

    let encryptedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const zap of zaps) {
      if (!zap.originalUrl) {
        skippedCount++;
        continue;
      }

      try {
        // Check if content starts with our prefixes
        let prefix = "";
        let content = "";

        if (zap.originalUrl.startsWith("TEXT_CONTENT:")) {
          prefix = "TEXT_CONTENT:";
          content = zap.originalUrl.substring(13);
        } else if (zap.originalUrl.startsWith("DOCX_CONTENT:")) {
          prefix = "DOCX_CONTENT:";
          content = zap.originalUrl.substring(13);
        } else if (zap.originalUrl.startsWith("PPTX_CONTENT:")) {
          prefix = "PPTX_CONTENT:";
          content = zap.originalUrl.substring(13);
        } else {
          // Content doesn't have our prefix, skip it
          skippedCount++;
          continue;
        }

        // Check if already encrypted
        if (isEncrypted(content)) {
          console.log(
            `⏭️  Skipping Zap ${zap.id} (${zap.name || "Untitled"}): already encrypted`
          );
          skippedCount++;
          continue;
        }

        // Encrypt the content
        const encryptedContent = encryptText(content);
        const newOriginalUrl = `${prefix}${encryptedContent}`;

        // Update the database
        await prisma.zap.update({
          where: { id: zap.id },
          data: { originalUrl: newOriginalUrl },
        });

        console.log(
          `✅ Encrypted Zap ${zap.id} (${zap.name || "Untitled"}): ${content.length} chars`
        );
        encryptedCount++;
      } catch (error) {
        errorCount++;
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ id: zap.id, error: errorMsg });
        console.error(`❌ Error encrypting Zap ${zap.id}:`, errorMsg);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("Migration Complete");
    console.log("=".repeat(70));
    console.log(`Total Zaps processed: ${zaps.length}`);
    console.log(`✅ Successfully encrypted: ${encryptedCount}`);
    console.log(`⏭️  Skipped (already encrypted or invalid): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log("\n❌ Errors encountered:");
      errors.forEach(({ id, error }) => {
        console.log(`   Zap ID ${id}: ${error}`);
      });
    }

    if (encryptedCount > 0) {
      console.log("\n✅ Migration successful!");
      console.log(
        "   All text content is now encrypted and protected at rest."
      );
    }
  } catch (error) {
    console.error("\n❌ Migration failed with error:");
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// Run migration
migrateTextContent();
