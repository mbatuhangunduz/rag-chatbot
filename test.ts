import fs from "fs";
import path from "path";
import pdf from "pdf-parse";

const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-.,;:!?()]/g, "")
    .trim();
};

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


const processPDF = async (filePath: string, filename: string) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);

    // Clean and split text into chunks
    const cleanedText = cleanText(pdfData.text);
    // console.log("cleanedText", cleanedText);
    const chunks = splitIntoChunks(cleanedText, 1000, 200); // 1000 chars with 200 overlap
    console.log("chunks", chunks[1]);

    console.log(`Processing ${filename}: ${chunks.length} chunks`);

    // Process chunks in batches
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      // await processBatch(batch, filename, i);
    }
  } catch (error) {
    console.error(`Error processing ${filename}:`, error);
    throw error;
  }
};

const pdfs = async() => {
  try {
    const pdfPath = path.join(__dirname, "zdocuments");
if (!fs.existsSync(pdfPath)) {
  fs.mkdirSync(pdfPath, { recursive: true });
}

const pdfFiles = fs
  .readdirSync(pdfPath)
  .filter((file) => file.toLowerCase().endsWith(".pdf"));

if (pdfFiles.length === 0) {
  console.log({
    error: "No PDF files found in pdfs directory",
  });
}

let processedCount = 0;
for (const filename of pdfFiles) {
  const filePath = path.join(pdfPath, filename);
  console.log("first", filePath);
  await processPDF(filePath, filename);
  processedCount++;
}

console.log("processedCount", processedCount);

  } catch (error) {
    console.error(`Error processing :`, error);
    throw error;
  }
}

pdfs()