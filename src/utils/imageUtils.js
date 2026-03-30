export const compressImage = async (file) => {
  return new Promise((resolve, reject) => {
    try {
      const maxWidth = 1200;
      const maxHeight = 1200;
      const quality = 0.8;
      const maxSizeBytes = 1024 * 1024; // 1MB limit for safety

      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        
        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width *= ratio;
              height *= ratio;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Image compression failed - empty blob'));
                  return;
                }
                
                // If blob is still too big, we might need to be stricter, but for now just accept it
                // or reject it.
                if (blob.size > maxSizeBytes) {
                    // Just warn in console, don't strictly reject unless critical
                    console.warn('Compressed image is still larger than 1MB');
                }

                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              },
              'image/jpeg',
              quality
            );
          } catch (err) {
            reject(err);
          }
        };
        
        img.onerror = (error) => reject(new Error('Failed to load image for compression'));
      };
      
      reader.onerror = (error) => reject(new Error('Failed to read file'));
    } catch (err) {
      reject(err);
    }
  });
};