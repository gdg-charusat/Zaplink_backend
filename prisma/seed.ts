import { PrismaClient, ZapType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('🗑️  Clearing existing data...');
  await prisma.zap.deleteMany();

  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const quizAnswerHash = await bcrypt.hash('paris', 10);

  // Sample Zaps
  const sampleZaps = [
    {
      shortId: 'pdf-demo',
      qrId: 'qr-pdf-demo',
      type: ZapType.PDF,
      name: 'Sample PDF Document',
      cloudUrl: 'https://res.cloudinary.com/demo/sample-pdf.pdf',
      originalUrl: null,
      passwordHash: null,
      viewLimit: null,
      viewCount: 5,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-pdf-demo',
    },
    {
      shortId: 'img-demo',
      qrId: 'qr-img-demo',
      type: ZapType.IMAGE,
      name: 'Beautiful Landscape',
      cloudUrl: 'https://res.cloudinary.com/demo/sample-image.jpg',
      originalUrl: null,
      passwordHash: null,
      viewLimit: 100,
      viewCount: 23,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-img-demo',
    },
    {
      shortId: 'secure-doc',
      qrId: 'qr-secure-doc',
      type: ZapType.WORD,
      name: 'Confidential Report',
      cloudUrl: 'https://res.cloudinary.com/demo/confidential-report.docx',
      originalUrl: null,
      passwordHash: passwordHash, // Password: TestPass123!
      viewLimit: 10,
      viewCount: 2,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-secure-doc',
    },
    {
      shortId: 'quiz-file',
      qrId: 'qr-quiz-file',
      type: ZapType.PDF,
      name: 'Quiz Protected Document',
      cloudUrl: 'https://res.cloudinary.com/demo/quiz-protected.pdf',
      originalUrl: null,
      passwordHash: null,
      viewLimit: null,
      viewCount: 0,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      quizQuestion: 'What is the capital of France?',
      quizAnswerHash: quizAnswerHash, // Answer: paris
      unlockAt: null,
      deletionToken: 'del-token-quiz-file',
    },
    {
      shortId: 'url-short',
      qrId: 'qr-url-short',
      type: ZapType.URL,
      name: 'GitHub Repository',
      cloudUrl: null,
      originalUrl: 'https://github.com/krishnapaljadeja/ZapLink',
      passwordHash: null,
      viewLimit: null,
      viewCount: 150,
      expiresAt: null,
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-url-short',
    },
    {
      shortId: 'text-note',
      qrId: 'qr-text-note',
      type: ZapType.TEXT,
      name: 'Quick Note',
      cloudUrl: 'data:text/plain;base64,VGhpcyBpcyBhIHNhbXBsZSB0ZXh0IG5vdGUgZm9yIHRlc3RpbmcgcHVycG9zZXMu',
      originalUrl: null,
      passwordHash: null,
      viewLimit: 50,
      viewCount: 12,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-text-note',
    },
    {
      shortId: 'video-demo',
      qrId: 'qr-video-demo',
      type: ZapType.VIDEO,
      name: 'Tutorial Video',
      cloudUrl: 'https://res.cloudinary.com/demo/video/sample-video.mp4',
      originalUrl: null,
      passwordHash: null,
      viewLimit: null,
      viewCount: 87,
      expiresAt: null,
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-video-demo',
    },
    {
      shortId: 'audio-demo',
      qrId: 'qr-audio-demo',
      type: ZapType.AUDIO,
      name: 'Podcast Episode',
      cloudUrl: 'https://res.cloudinary.com/demo/audio/sample-audio.mp3',
      originalUrl: null,
      passwordHash: null,
      viewLimit: null,
      viewCount: 45,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-audio-demo',
    },
    {
      shortId: 'zip-archive',
      qrId: 'qr-zip-archive',
      type: ZapType.ZIP,
      name: 'Project Files',
      cloudUrl: 'https://res.cloudinary.com/demo/archive/project-files.zip',
      originalUrl: null,
      passwordHash: passwordHash, // Password: TestPass123!
      viewLimit: 5,
      viewCount: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-zip-archive',
    },
    {
      shortId: 'ppt-demo',
      qrId: 'qr-ppt-demo',
      type: ZapType.PPT,
      name: 'Company Presentation',
      cloudUrl: 'https://res.cloudinary.com/demo/presentation/company-ppt.pptx',
      originalUrl: null,
      passwordHash: null,
      viewLimit: 25,
      viewCount: 8,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-ppt-demo',
    },
    {
      shortId: 'delayed-unlock',
      qrId: 'qr-delayed-unlock',
      type: ZapType.PDF,
      name: 'Future Release Document',
      cloudUrl: 'https://res.cloudinary.com/demo/future-document.pdf',
      originalUrl: null,
      passwordHash: null,
      viewLimit: null,
      viewCount: 0,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Unlocks in 2 days
      deletionToken: 'del-token-delayed-unlock',
    },
    {
      shortId: 'expired-zap',
      qrId: 'qr-expired-zap',
      type: ZapType.IMAGE,
      name: 'Expired Image',
      cloudUrl: 'https://res.cloudinary.com/demo/expired-image.jpg',
      originalUrl: null,
      passwordHash: null,
      viewLimit: null,
      viewCount: 50,
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Expired yesterday
      quizQuestion: null,
      quizAnswerHash: null,
      unlockAt: null,
      deletionToken: 'del-token-expired-zap',
    },
  ];

  // Create all zaps
  console.log('📝 Creating sample Zaps...');
  for (const zapData of sampleZaps) {
    await prisma.zap.create({
      data: zapData,
    });
    console.log(`   ✅ Created: ${zapData.shortId} (${zapData.type})`);
  }

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Total Zaps created: ${sampleZaps.length}`);
  console.log(`   - Password for protected zaps: TestPass123!`);
  console.log(`   - Quiz answer for quiz-protected zap: paris`);
  console.log('\n🔗 Sample Short IDs you can test:');
  console.log('   - pdf-demo (public PDF)');
  console.log('   - img-demo (public image)');
  console.log('   - secure-doc (password protected)');
  console.log('   - quiz-file (quiz protected)');
  console.log('   - url-short (URL shortener)');
  console.log('   - text-note (text content)');
  console.log('   - delayed-unlock (unlocks in 2 days)');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
