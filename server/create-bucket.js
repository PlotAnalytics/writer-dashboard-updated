const { Storage } = require('@google-cloud/storage');
const path = require('path');

async function createBucket() {
  try {
    // Initialize Google Cloud Storage
    const storage = new Storage({
      keyFilename: path.join(__dirname, '../admin_dashboard.json'),
      projectId: 'speedy-web-461014-g3',
    });

    const bucketName = 'writer-dashboard-avatars';
    const bucket = storage.bucket(bucketName);

    // Check if bucket exists
    const [exists] = await bucket.exists();
    if (exists) {
      console.log('✅ Bucket already exists:', bucketName);
      return;
    }

    // Create bucket
    console.log('📦 Creating bucket:', bucketName);
    await storage.createBucket(bucketName, {
      location: 'US',
      storageClass: 'STANDARD',
    });
    
    console.log('✅ Bucket created successfully:', bucketName);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 403) {
      console.log('📝 The service account needs Storage Admin permissions.');
      console.log('📝 Please create the bucket manually in Google Cloud Console:');
      console.log('   - Go to https://console.cloud.google.com/storage');
      console.log('   - Click "Create Bucket"');
      console.log('   - Name: writer-dashboard-avatars');
      console.log('   - Location: US');
      console.log('   - Storage class: Standard');
    }
  }
}

createBucket();
