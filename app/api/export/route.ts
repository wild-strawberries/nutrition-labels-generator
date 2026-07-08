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
  const slugFilename = `${makeSlug(productName) || 'product'}.json`;
  const outputDir = path.join(process.cwd(), 'Labels');

  try {
    // Editing an existing label (originalFilename provided)
    if (body.originalFilename) {
      const originalFilename = body.originalFilename;
      const intendedFilename = slugFilename;
      const originalPath = path.join(outputDir, originalFilename);
      const intendedPath = path.join(outputDir, intendedFilename);

      // If the product name changed, write new file and remove the original
      if (intendedFilename !== originalFilename) {
        try {
          await fs.access(intendedPath);
          // Target filename already exists -> conflict
          return NextResponse.json(
            { error: `A label with the name "${productName}" already exists. Choose a different product name.` },
            { status: 409 }
          );
        } catch {
          // intended does not exist, proceed
        }

        const out = { ...body } as any;
        delete out.originalFilename;
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(intendedPath, JSON.stringify(out, null, 2), 'utf-8');

        try {
          await fs.unlink(originalPath);
        } catch (e) {
          // ignore errors when deleting original
        }

        return NextResponse.json({ filename: intendedFilename });
      }

      // Same filename: overwrite
      const out = { ...body } as any;
      delete out.originalFilename;
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(originalPath, JSON.stringify(out, null, 2), 'utf-8');
      return NextResponse.json({ filename: originalFilename });
    }

    // Creating a new label: ensure we don't overwrite existing file
    const outputPath = path.join(outputDir, slugFilename);
    try {
      await fs.access(outputPath);
      return NextResponse.json(
        { error: `A label with the name "${productName}" already exists. Please use a different product name.` },
        { status: 409 }
      );
    } catch {
      // safe to create
    }

    const out = { ...body } as any;
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(out, null, 2), 'utf-8');
    return NextResponse.json({ filename: slugFilename });
  } catch (error) {
    return NextResponse.json({ error: 'Could not write export file.' }, { status: 500 });
  }
}
