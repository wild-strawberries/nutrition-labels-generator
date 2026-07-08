import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

type ExportBody = {
  productName: string;
  finalWeight: number;
  ingredients: Array<{ name: string; quantity: number; unit: string; ingredientId: string }>;
  nutritionTotals: Record<string, number>;
  nutritionPer100g: Record<string, number>;
  originalFilename?: string;
};

function makeSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ExportBody;
  const productName = body.productName || 'product';
  const filename = body.originalFilename
    ? body.originalFilename
    : `${makeSlug(productName) || 'product'}.json`;
  const outputDir = path.join(process.cwd(), 'Labels');
  const outputPath = path.join(outputDir, filename);

  try {
    // If no originalFilename provided, check for existing file to avoid accidental overwrite
    if (!body.originalFilename) {
      try {
        await fs.access(outputPath);
        // File exists, return error
        return NextResponse.json(
          { error: `A label with the name "${productName}" already exists. Please use a different product name.` },
          { status: 409 }
        );
      } catch {
        // File does not exist, safe to proceed
      }
    }

    await fs.mkdir(outputDir, { recursive: true });
    // Write/overwrite the file with the provided body (strip originalFilename if present)
    const out = { ...body } as any;
    delete out.originalFilename;
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(out, null, 2), 'utf-8');
    return NextResponse.json({ filename });
  } catch (error) {
    return NextResponse.json({ error: 'Could not write export file.' }, { status: 500 });
  }
}
