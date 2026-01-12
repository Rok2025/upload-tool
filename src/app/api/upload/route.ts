import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads/tmp');

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const chunk = formData.get('chunk') as File;
        const chunkIndex = parseInt(formData.get('chunkIndex') as string);
        const totalChunks = parseInt(formData.get('totalChunks') as string);
        const fileName = formData.get('fileName') as string;
        const fileHash = formData.get('fileHash') as string;

        if (!chunk || !fileHash) {
            return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
        }

        const chunkDir = path.join(UPLOAD_ROOT, fileHash);

        // Ensure upload directory exists
        await fs.mkdir(chunkDir, { recursive: true });

        const chunkPath = path.join(chunkDir, `${chunkIndex}`);
        const arrayBuffer = await chunk.arrayBuffer();
        await fs.writeFile(chunkPath, Buffer.from(arrayBuffer));

        // Check if all chunks are uploaded
        const files = await fs.readdir(chunkDir);
        if (files.length === totalChunks) {
            // Merge chunks
            const mergedFilePath = path.join(UPLOAD_ROOT, fileName);
            const writeStream = (await import('fs')).createWriteStream(mergedFilePath);

            for (let i = 0; i < totalChunks; i++) {
                const currentChunkPath = path.join(chunkDir, `${i}`);
                const chunkData = await fs.readFile(currentChunkPath);
                writeStream.write(chunkData);
                await fs.unlink(currentChunkPath); // Delete chunk after merging
            }

            writeStream.end();
            await fs.rmdir(chunkDir); // Remove chunk directory

            return NextResponse.json({
                message: 'Upload complete',
                path: mergedFilePath
            });
        }

        return NextResponse.json({
            message: `Chunk ${chunkIndex} uploaded successfully`,
            chunksReceived: files.length
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
