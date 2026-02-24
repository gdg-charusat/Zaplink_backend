/**
 * Test script for text encryption/decryption functionality
 * Run this to verify that encryption is working correctly
 * 
 * Usage: npx ts-node src/utils/encryption.test.ts
 */

import { encryptText, decryptText, isEncrypted } from "./encryption";

console.log("=".repeat(60));
console.log("Testing Text Encryption/Decryption");
console.log("=".repeat(60));

try {
  // Test 1: Basic encryption and decryption
  console.log("\n[Test 1] Basic Encryption/Decryption");
  const testText1 = "Hello, this is a test message!";
  console.log("Original text:", testText1);
  
  const encrypted1 = encryptText(testText1);
  console.log("Encrypted text:", encrypted1.substring(0, 50) + "...");
  console.log("Is encrypted:", isEncrypted(encrypted1));
  
  const decrypted1 = decryptText(encrypted1);
  console.log("Decrypted text:", decrypted1);
  console.log("✓ Test 1 passed:", testText1 === decrypted1);

  // Test 2: Long text encryption
  console.log("\n[Test 2] Long Text Encryption");
  const testText2 = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50);
  console.log("Original length:", testText2.length, "characters");
  
  const encrypted2 = encryptText(testText2);
  console.log("Encrypted length:", encrypted2.length, "characters");
  
  const decrypted2 = decryptText(encrypted2);
  console.log("Decrypted length:", decrypted2.length, "characters");
  console.log("✓ Test 2 passed:", testText2 === decrypted2);

  // Test 3: Special characters
  console.log("\n[Test 3] Special Characters");
  const testText3 = "Special chars: !@#$%^&*()_+-={}[]|\\:;<>?,./~`\"'";
  console.log("Original text:", testText3);
  
  const encrypted3 = encryptText(testText3);
  const decrypted3 = decryptText(encrypted3);
  console.log("Decrypted text:", decrypted3);
  console.log("✓ Test 3 passed:", testText3 === decrypted3);

  // Test 4: Unicode and emojis
  console.log("\n[Test 4] Unicode and Emojis");
  const testText4 = "Testing unicode: 你好世界 🚀 🔐 💯 Café ñoño";
  console.log("Original text:", testText4);
  
  const encrypted4 = encryptText(testText4);
  const decrypted4 = decryptText(encrypted4);
  console.log("Decrypted text:", decrypted4);
  console.log("✓ Test 4 passed:", testText4 === decrypted4);

  // Test 5: Multiline text
  console.log("\n[Test 5] Multiline Text");
  const testText5 = `Line 1: This is a test
Line 2: With multiple lines
Line 3: And proper formatting
Line 4: Should be preserved`;
  console.log("Original text:\n", testText5);
  
  const encrypted5 = encryptText(testText5);
  const decrypted5 = decryptText(encrypted5);
  console.log("Decrypted text:\n", decrypted5);
  console.log("✓ Test 5 passed:", testText5 === decrypted5);

  // Test 6: Each encryption produces different output
  console.log("\n[Test 6] Encryption Uniqueness");
  const testText6 = "Same text encrypted twice";
  const encrypted6a = encryptText(testText6);
  const encrypted6b = encryptText(testText6);
  console.log("Same text produces different encrypted output:", encrypted6a !== encrypted6b);
  console.log("Both decrypt correctly:", 
    decryptText(encrypted6a) === testText6 && 
    decryptText(encrypted6b) === testText6
  );
  console.log("✓ Test 6 passed:", 
    encrypted6a !== encrypted6b && 
    decryptText(encrypted6a) === testText6
  );

  // Test 7: isEncrypted function
  console.log("\n[Test 7] isEncrypted Detection");
  console.log("Plain text detected as not encrypted:", !isEncrypted("plain text"));
  console.log("Encrypted text detected as encrypted:", isEncrypted(encrypted1));
  console.log("✓ Test 7 passed");

  console.log("\n" + "=".repeat(60));
  console.log("✅ All tests passed successfully!");
  console.log("=".repeat(60));

} catch (error) {
  console.error("\n❌ Test failed with error:");
  console.error(error);
  process.exit(1);
}
