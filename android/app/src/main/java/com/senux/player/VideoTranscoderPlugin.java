package com.senux.player;

import android.net.Uri;
import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.EditedMediaItemSequence;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.Arrays;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
@CapacitorPlugin(name = "VideoTranscoder")
public class VideoTranscoderPlugin extends Plugin {

    @PluginMethod
    public void transcode(PluginCall call) {
        String videoPath = call.getString("videoPath");
        String audioPath = call.getString("audioPath");
        String outputPath = call.getString("outputPath");
        Double startDouble = call.getDouble("audioStartMs", 0.0);
        Double endDouble = call.getDouble("audioEndMs", 0.0);
        long audioStartMs = startDouble != null ? startDouble.longValue() : 0L;
        long audioEndMs = endDouble != null ? endDouble.longValue() : 0L;

        android.util.Log.d("VideoTranscoder", "Parsing inputs - videoPath: " + videoPath);
        android.util.Log.d("VideoTranscoder", "Parsing inputs - audioPath: " + audioPath);
        android.util.Log.d("VideoTranscoder", "Parsing inputs - startMs: " + audioStartMs + ", endMs: " + audioEndMs);

        if (videoPath == null || audioPath == null || outputPath == null) {
            call.reject("Input paths or output path is null");
            return;
        }

        try {
            File videoFile = videoPath.startsWith("file://") ? new File(Uri.parse(videoPath).getPath()) : new File(videoPath);
            File audioFile = audioPath.startsWith("file://") ? new File(Uri.parse(audioPath).getPath()) : new File(audioPath);
            File outputFile = outputPath.startsWith("file://") ? new File(Uri.parse(outputPath).getPath()) : new File(outputPath);

            if (!videoFile.exists()) {
                call.reject("Video file does not exist: " + videoFile.getAbsolutePath());
                return;
            }
            if (!audioFile.exists()) {
                call.reject("Audio file does not exist: " + audioFile.getAbsolutePath());
                return;
            }

            File parentDir = outputFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            if (outputFile.exists()) {
                outputFile.delete();
            }

            getActivity().runOnUiThread(() -> {
                try {
                    // Create Video Sequence
                    EditedMediaItem videoEditedMediaItem = new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(videoFile)))
                        .setRemoveAudio(true)
                        .build();
                    EditedMediaItemSequence videoSequence = new EditedMediaItemSequence(
                        Arrays.asList(videoEditedMediaItem)
                    );

                    // Create Audio Item with optional clipping
                    MediaItem.Builder audioMediaItemBuilder = new MediaItem.Builder()
                        .setUri(Uri.fromFile(audioFile));

                    if (audioEndMs > audioStartMs) {
                        MediaItem.ClippingConfiguration clippingConfiguration = new MediaItem.ClippingConfiguration.Builder()
                            .setStartPositionMs(audioStartMs)
                            .setEndPositionMs(audioEndMs)
                            .build();
                        audioMediaItemBuilder.setClippingConfiguration(clippingConfiguration);
                        android.util.Log.d("VideoTranscoder", "Clipping configuration applied: " + audioStartMs + "ms to " + audioEndMs + "ms");
                    } else {
                        android.util.Log.w("VideoTranscoder", "Clipping skipped: endMs <= startMs (" + audioStartMs + "ms to " + audioEndMs + "ms)");
                    }

                    MediaItem audioMediaItem = audioMediaItemBuilder.build();
                    EditedMediaItem audioEditedMediaItem = new EditedMediaItem.Builder(audioMediaItem)
                        .setRemoveVideo(true)
                        .build();
                    EditedMediaItemSequence audioSequence = new EditedMediaItemSequence(
                        Arrays.asList(audioEditedMediaItem)
                    );

                    // Compose Video + Audio together
                    Composition composition = new Composition.Builder(
                        Arrays.asList(videoSequence, audioSequence)
                    ).build();

                    Transformer transformer = new Transformer.Builder(getContext())
                        .setAudioMimeType("audio/mp4a-latm") // Force AAC encoding
                        .setVideoMimeType("video/avc")        // Force H.264 encoding
                        .addListener(new Transformer.Listener() {
                            @Override
                            public void onCompleted(Composition composition, ExportResult exportResult) {
                                JSObject ret = new JSObject();
                                ret.put("success", true);
                                ret.put("outputPath", "file://" + outputFile.getAbsolutePath());
                                call.resolve(ret);
                            }

                            @Override
                            public void onError(Composition composition, ExportResult exportResult, ExportException exportException) {
                                call.reject("Transcoding failed: " + exportException.getMessage(), exportException);
                            }
                        })
                        .build();

                    transformer.start(composition, outputFile.getAbsolutePath());
                } catch (Exception e) {
                    call.reject("Error starting transcode composition: " + e.getMessage(), e);
                }
            });

        } catch (Exception e) {
            call.reject("Failed to parse paths: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String videoPath = call.getString("videoPath");
        String filename = call.getString("filename");

        if (videoPath == null || filename == null) {
            call.reject("Video path or filename is null");
            return;
        }

        try {
            File sourceFile = videoPath.startsWith("file://") ? new File(Uri.parse(videoPath).getPath()) : new File(videoPath);
            if (!sourceFile.exists()) {
                call.reject("Source file does not exist: " + sourceFile.getAbsolutePath());
                return;
            }

            Uri uri = null;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "video/mp4");
                values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS);

                android.content.ContentResolver resolver = getContext().getContentResolver();
                uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                if (uri != null) {
                    try (java.io.OutputStream out = resolver.openOutputStream(uri);
                         java.io.FileInputStream in = new java.io.FileInputStream(sourceFile)) {
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                        }
                    }
                }
            } else {
                File downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                File destFile = new File(downloadsDir, filename);
                try (java.io.FileOutputStream out = new java.io.FileOutputStream(destFile);
                     java.io.FileInputStream in = new java.io.FileInputStream(sourceFile)) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                    }
                }
                uri = Uri.fromFile(destFile);
            }

            if (uri != null) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("uri", uri.toString());
                call.resolve(ret);
            } else {
                call.reject("Failed to save file to downloads");
            }
        } catch (Exception e) {
            call.reject("Failed to save to downloads: " + e.getMessage(), e);
        }
    }
}
