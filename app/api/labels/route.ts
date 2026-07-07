import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const labelsDir = path.join(process.cwd(), 'Labels');

  try {
    const files = await fs.readdir(labelsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    
    const labels = await Promise.all(
      jsonFiles.map(async (filename) => {
        try {
          const filePath = path.join(labelsDir, filename);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          return {
            filename,
            productName: data.productName,
            data
          };
        } catch (error) {
          return null;
        }
      })
    );

    return NextResponse.json(labels.filter((l) => l !== null));
  } catch (error) {
    return NextResponse.json([]);
  }
}
