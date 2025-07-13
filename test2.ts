// const splitIntoChunks = (text: string, chunkSize: number, overlap: number): string[] => {
//     const chunks: string[] = [];
//     let start = 0;
    
//     // Overlap'in chunk size'dan küçük olduğunu garanti et
//     const safeOverlap = Math.min(overlap, Math.floor(chunkSize * 0.5));
    
//     while (start < text.length) {
//       const end = Math.min(start + chunkSize, text.length);
//       let chunk = text.substring(start, end);
//       let actualEnd = end;
      
//       // Try to break at sentence boundaries
//       if (end < text.length) {
//         const lastSentence = chunk.lastIndexOf('.');
//         if (lastSentence > chunk.length * 0.7) {
//           chunk = chunk.substring(0, lastSentence + 1);
//           actualEnd = start + lastSentence + 1;
//         }
//       }
      
//       const trimmedChunk = chunk.trim();
//       if (trimmedChunk.length > 50) {
//         chunks.push(trimmedChunk);
//       }
      
//       // 🔧 DÜZELTİLMİŞ KISIM: Doğru ilerleme hesaplaması
//       if (actualEnd >= text.length) {
//         // Text'in sonuna geldik, döngüden çık
//         break;
//       }
      
//       // Normal overlap hesaplaması
//       const nextStart = actualEnd - safeOverlap;
      
//       // Eğer yeterli ilerleme sağlanamıyorsa, minimum ilerleme garantisi
//       if (nextStart <= start) {
//         start = start + Math.max(1, Math.floor(chunkSize * 0.1)); // En az chunk'ın %10'u kadar ilerle
//       } else {
//         start = nextStart;
//       }
//     }
    
//     return chunks;
//   };
  
//   // Test fonksiyonu
//   const testFixedChunking = () => {
//     const testText = "RAG powered chatbot: Create an API that takes a question as a parameter. This API will answer device related questions and the answer has to come from the content of the PDFs. Requirements: Input parameters is a string where we can add a question Returns a readable piece of text API written with Node.jsTypescript";
    
//     console.log(`🧪 Testing with text length: ${testText.length}`);
    
//     const chunks = splitIntoChunks(testText, 1000, 200);
    
//     console.log(`📊 Result: ${chunks.length} chunks`);
//     chunks.forEach((chunk, index) => {
//       console.log(`Chunk ${index + 1} (${chunk.length} chars): "${chunk}"`);
//     });
    
//     // Farklı parametrelerle test
//     console.log('\n🔄 Testing with smaller chunk size:');
//     const smallChunks = splitIntoChunks(testText, 100, 20);
//     console.log(`📊 Result: ${smallChunks.length} chunks`);
//     smallChunks.forEach((chunk, index) => {
//       console.log(`Chunk ${index + 1} (${chunk.length} chars): "${chunk}..."`);
//     });
//   };
  
//   testFixedChunking();

// // const splitIntoChunks = (text: string, chunkSize: number, overlap: number): string[] => {
// //     const chunks: string[] = [];
    
// //     // Güvenlik kontrolleri
// //     if (text.length <= chunkSize) {
// //       return text.trim().length > 50 ? [text.trim()] : [];
// //     }
    
// //     // Overlap çok büyükse küçült
// //     if (overlap >= chunkSize) {
// //       overlap = Math.floor(chunkSize * 0.3);
// //     }
    
// //     let start = 0;
    
// //     while (start < text.length) {
// //       let end = Math.min(start + chunkSize, text.length);
      
// //       // Eğer text'in sonuna gelmediyse, iyi bir kesim noktası bul
// //       if (end < text.length) {
// //         const chunk = text.substring(start, end);
        
// //         // Önce cümle sonu ara
// //         const lastDot = chunk.lastIndexOf('.');
// //         if (lastDot > chunk.length * 0.6) {
// //           end = start + lastDot + 1;
// //         } else {
// //           // Cümle sonu yoksa kelime sınırında böl
// //           const lastSpace = chunk.lastIndexOf(' ');
// //           if (lastSpace > chunk.length * 0.8) {
// //             end = start + lastSpace;
// //           }
// //         }
// //       }
      
// //       const chunk = text.substring(start, end).trim();
      
// //       if (chunk.length > 50) {
// //         chunks.push(chunk);
// //       }
      
// //       // Bir sonraki başlangıç noktası
// //       if (end >= text.length) {
// //         break; // Bitirdik
// //       }
      
// //       // Overlap ile geri git, ama minimum ilerleme garantisi
// //       start = Math.max(start + 1, end - overlap);
// //     }
    
// //     return chunks;
// //   };
  
// //   // Test
// //   const testText = "RAG powered chatbot: Create an API that takes a question as a parameter. This API will answer device related questions and the answer has to come from the content of the PDFs. Requirements: Input parameters is a string where we can add a question Returns a readable piece of text API written with Node.jsTypescript";
  
// //   console.log(`Text length: ${testText.length}`);
  
// //   const result = splitIntoChunks(testText, 100, 20);
// //   console.log(`Chunks created: ${result.length}`);
  
// //   result.forEach((chunk, i) => {
// //     console.log(`Chunk ${i + 1}: "${chunk}"`);
// //   });

// const splitIntoChunks = (text: string, chunkSize: number, overlap: number): string[] => {
//     const chunks: string[] = [];
    
//     if (text.length <= chunkSize) {
//       return text.trim().length > 50 ? [text.trim()] : [];
//     }
    
//     // Overlap çok büyükse küçült
//     if (overlap >= chunkSize) {
//       overlap = Math.floor(chunkSize * 0.3);
//     }
    
//     // Metni cümlelere böl
//     const sentences:any = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
//     let currentChunk = '';
//     let currentStart = 0;
    
//     for (let i = 0; i < sentences.length; i++) {
//       const sentence = sentences[i].trim();
      
//       // Eğer mevcut chunk + yeni cümle chunk size'ı aşacaksa
//       if (currentChunk.length + sentence.length + 1 > chunkSize && currentChunk.length > 0) {
//         // Mevcut chunk'ı kaydet
//         if (currentChunk.trim().length > 50) {
//           chunks.push(currentChunk.trim());
//         }
        
//         // Yeni chunk'ı başlat - overlap için önceki cümleleri dahil et
//         currentChunk = '';
        
//         // Overlap için geri git
//         let overlapLength = 0;
//         let backIndex = i - 1;
        
//         // Overlap kadar geri giderek cümleleri topla
//         while (backIndex >= 0 && overlapLength < overlap) {
//           const prevSentence = sentences[backIndex].trim();
//           if (overlapLength + prevSentence.length + 1 <= overlap) {
//             currentChunk = prevSentence + ' ' + currentChunk;
//             overlapLength += prevSentence.length + 1;
//             backIndex--;
//           } else {
//             break;
//           }
//         }
        
//         // Mevcut cümleyi ekle
//         currentChunk = (currentChunk + ' ' + sentence).trim();
//       } else {
//         // Mevcut chunk'a cümleyi ekle
//         currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
//       }
//     }
    
//     // Son chunk'ı ekle
//     if (currentChunk.trim().length > 50) {
//       chunks.push(currentChunk.trim());
//     }
    
//     return chunks;
//   };
  
//   // Test fonksiyonu
//   const testSentenceAwareChunking = () => {
//     const testText = "RAG powered chatbot: Create an API that takes a question as a parameter. This API will answer device related questions and the answer has to come from the content of the PDFs. Requirements: Input parameters is a string where we can add a question Returns a readable piece of text API written with Node.jsTypescript";
    
//     console.log(`🧪 Testing sentence-aware chunking with text length: ${testText.length}`);
    
//     console.log('\n📊 Testing with chunk size 100, overlap 30:');
//     const chunks = splitIntoChunks(testText, 100, 30);
//     console.log(`Result: ${chunks.length} chunks`);
    
//     chunks.forEach((chunk, index) => {
//       console.log(`\nChunk ${index + 1} (${chunk.length} chars):`);
//       console.log(`"${chunk}"`);
//       console.log(`Starts with: "${chunk.split(' ').slice(0, 3).join(' ')}..."`);
//       console.log(`Ends with: "...${chunk.split(' ').slice(-3).join(' ')}"`);
//     });
    
//     console.log('\n🔄 Testing with larger chunks (150, overlap 40):');
//     const largerChunks = splitIntoChunks(testText, 150, 40);
//     console.log(`Result: ${largerChunks.length} chunks`);
    
//     largerChunks.forEach((chunk, index) => {
//       console.log(`\nChunk ${index + 1} (${chunk.length} chars):`);
//       console.log(`"${chunk}"`);
//     });
//   };
  
//   testSentenceAwareChunking();


const splitIntoChunks = (text: string, chunkSize: number, overlap: number): string[] => {
    const chunks: string[] = [];
    
    // Güvenlik kontrolleri
    if (text.length <= chunkSize) {
      return text.trim().length > 50 ? [text.trim()] : [];
    }
    
    // Overlap çok büyükse küçült
    if (overlap >= chunkSize) {
      overlap = Math.floor(chunkSize * 0.3);
    }
    
    let start = 0;
    
    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      
      // Eğer text'in sonuna gelmediyse, iyi bir kesim noktası bul
      if (end < text.length) {
        const chunk = text.substring(start, end);
        
        // Önce cümle sonu ara
        const lastDot = chunk.lastIndexOf('.');
        if (lastDot > chunk.length * 0.6) {
          end = start + lastDot + 1;
        } else {
          // Cümle sonu yoksa kelime sınırında böl
          const lastSpace = chunk.lastIndexOf(' ');
          if (lastSpace > chunk.length * 0.8) {
            end = start + lastSpace;
          }
        }
      }
      
      const chunk = text.substring(start, end).trim();
      
      if (chunk.length > 50) {
        chunks.push(chunk);
      }
      
      // Bir sonraki başlangıç noktası
      if (end >= text.length) {
        break; // Bitirdik
      }
      
      // 🔧 DÜZELTME: Overlap ile geri git ama kelime sınırında başla
      let nextStart = end - overlap;
      
      // Kelime ortasında başlamamak için en yakın kelime başlangıcını bul
      if (nextStart > start) {
        // Geriye doğru giderek en yakın boşluğu bul
        while (nextStart > start && text[nextStart] !== ' ' && text[nextStart] !== '.') {
          nextStart--;
        }
        
        // Eğer boşluk bulduysa, boşluktan sonraki karakterden başla
        if (text[nextStart] === ' ') {
          nextStart++;
        }
      }
      
      // Minimum ilerleme garantisi
      start = Math.max(start + 1, nextStart);
    }
    
    return chunks;
  };
  
  // Test fonksiyonu
  const testWordBoundaryChunking = () => {
    const testText = "RAG powered chatbot: Create an API that takes a question as a parameter. This API will answer device related questions and the answer has to come from the content of the PDFs. Requirements: Input parameters is a string where we can add a question Returns a readable piece of text API written with Node.jsTypescript";
    
    console.log(`🧪 Testing with text length: ${testText.length}`);
    
    console.log('\n📊 Testing with chunk size 100, overlap 20:');
    const chunks = splitIntoChunks(testText, 1000, 200);
    console.log(`Result: ${chunks.length} chunks`);
    
    chunks.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1} (${chunk.length} chars):`);
      console.log(`"${chunk}"`);
      console.log(`Starts with: "${chunk.substring(0, 10)}..."`);
    });
    
    console.log('\n🔄 Testing with larger chunks (200, overlap 50):');
    const largerChunks = splitIntoChunks(testText, 1000, 200);
    console.log(`Result: ${largerChunks.length} chunks`);
    
    largerChunks.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1} (${chunk.length} chars):`);
      console.log(`"${chunk}"`);
    });
  };
  
  testWordBoundaryChunking();