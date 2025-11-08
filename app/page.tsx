'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';

type Stage = 'idle' | 'loading-ffmpeg' | 'ready' | 'processing' | 'completed' | 'error';

export default function Home() {
  const ffmpegRef = useRef<import('@ffmpeg/ffmpeg').FFmpeg | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(1.25);
  const [toneMapping, setToneMapping] = useState<'hable' | 'mobius' | 'reinhard'>('hable');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadFFmpeg = async () => {
      if (ffmpegRef.current || stage === 'loading-ffmpeg') {
        return;
      }
      setStage('loading-ffmpeg');

      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
        const ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
          setLogMessages(prev => {
            const updated = [...prev.slice(-24), message];
            return updated;
          });
        });

        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
        });

        ffmpegRef.current = ffmpeg;
        setStage('ready');
      } catch (error) {
        console.error(error);
        setErrorMessage('Failed to initialize the HDR engine. Refresh and try again.');
        setStage('error');
      }
    };

    void loadFFmpeg();
  }, [stage]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setOutputUrl(previous => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
      setStage(ffmpegRef.current ? 'ready' : stage);
    }
  }, [stage]);

  const processVideo = useCallback(async () => {
    if (!ffmpegRef.current || !selectedFile) {
      return;
    }

    setStage('processing');
    setErrorMessage(null);
    setLogMessages([]);

    const inputName = 'input-video.mp4';
    const outputName = 'hdr-output.mp4';

    try {
      const ffmpeg = ffmpegRef.current;
      const { fetchFile } = await import('@ffmpeg/util');
      await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

      const saturation = intensity.toFixed(2);
      const contrast = (0.9 + (intensity - 1) * 0.8).toFixed(2);
      const highlight = (0.3 * intensity).toFixed(2);
      const midtones = (0.2 * intensity).toFixed(2);

      const filterComplex = [
        `zscale=transfer=bt709:matrix=bt709:primaries=bt709`,
        `split=3[luma][mid][hi]`,
        `[luma]eq=gamma=${contrast}:saturation=${saturation}[luma_adj]`,
        `[mid]curves=preset=medium_contrast:intensity=${midtones}[mid_adj]`,
        `[hi]curves=preset=strong_contrast:intensity=${highlight}[hi_adj]`,
        `[luma_adj][mid_adj]blend=all_mode='screen'[mix1]`,
        `[mix1][hi_adj]blend=all_mode='lighten'[pre_hdr]`,
        `[pre_hdr]tonemap=${toneMapping}:desat=${(1.25 / intensity).toFixed(2)}:peak=1000[z]`,
        `[z]zscale=matrix=bt2020ncl:primaries=bt2020:transfer=smpte2084,format=yuv420p10le`
      ];

      const command = [
        '-i',
        inputName,
        '-vf',
        filterComplex.join(';'),
        '-c:v',
        'libx265',
        '-preset',
        'medium',
        '-pix_fmt',
        'yuv420p10le',
        '-tag:v',
        'hvc1',
        '-c:a',
        'copy',
        outputName
      ];

      await ffmpeg.exec(command);
      const data = await ffmpeg.readFile(outputName);
      const fileData = data as Uint8Array;
      const url = URL.createObjectURL(new Blob([fileData], { type: 'video/mp4' }));
      setOutputUrl(url);
      setStage('completed');
    } catch (error) {
      console.error(error);
      setErrorMessage('Conversion failed. Try lowering intensity or using a shorter clip.');
      setStage('error');
    } finally {
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg) {
        try {
          await ffmpeg.deleteFile(inputName);
        } catch {
          // ignore
        }
        try {
          await ffmpeg.deleteFile(outputName);
        } catch {
          // ignore
        }
      }
    }
  }, [intensity, selectedFile, toneMapping]);

  useEffect(() => {
    return () => {
      setOutputUrl(previous => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
    };
  }, []);

  const inputPreviewUrl = useMemo(() => {
    if (!selectedFile) {
      return null;
    }
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (inputPreviewUrl) {
        URL.revokeObjectURL(inputPreviewUrl);
      }
    };
  }, [inputPreviewUrl]);

  const isProcessing = stage === 'processing';
  const isReady = stage === 'ready' || stage === 'completed' || stage === 'idle' || stage === 'error';

  const stageLabel = useMemo(() => {
    switch (stage) {
      case 'idle':
        return 'Initializing HDR engine…';
      case 'loading-ffmpeg':
        return 'Loading HDR engine…';
      case 'ready':
        return 'Ready for conversion';
      case 'processing':
        return 'Converting to HDR…';
      case 'completed':
        return 'HDR conversion completed';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  }, [stage]);

  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <div>
          <h1>Realistic HDR Video Converter</h1>
          <p>
            Transform SDR footage into vivid HDR-inspired clips right in your browser. Upload a clip, tweak the dynamic range,
            and download the enhanced result—no server upload required.
          </p>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusDot} data-stage={stage} />
          <span>{stageLabel}</span>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.inputRow}>
          <label className={styles.fileInputLabel}>
            <input
              type="file"
              accept="video/*"
              disabled={!isReady}
              onChange={handleFileChange}
            />
            <span>{selectedFile ? selectedFile.name : 'Choose SDR video'}</span>
          </label>

          <button
            type="button"
            className={styles.convertButton}
            disabled={!selectedFile || !isReady || isProcessing}
            onClick={() => void processVideo()}
          >
            {isProcessing ? 'Processing…' : 'Convert to HDR'}
          </button>
        </div>

        <div className={styles.controls}>
          <div className={styles.sliderGroup}>
            <label htmlFor="intensity">
              HDR Intensity
              <span>{intensity.toFixed(2)}×</span>
            </label>
            <input
              id="intensity"
              type="range"
              min={1}
              max={1.7}
              step={0.05}
              value={intensity}
              onChange={event => setIntensity(parseFloat(event.target.value))}
            />
          </div>

          <div className={styles.selectGroup}>
            <label htmlFor="toneMapping">Tone Mapping Curve</label>
            <select
              id="toneMapping"
              value={toneMapping}
              onChange={event => setToneMapping(event.target.value as typeof toneMapping)}
            >
              <option value="hable">Hable (Filmic)</option>
              <option value="mobius">Mobius (Balanced)</option>
              <option value="reinhard">Reinhard (Natural)</option>
            </select>
          </div>
        </div>

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

        <div className={styles.previews}>
          <div>
            <h2>Source Preview</h2>
            {inputPreviewUrl ? (
              <video controls src={inputPreviewUrl} className={styles.video} />
            ) : (
              <div className={styles.placeholder}>Upload a clip to preview</div>
            )}
          </div>

          <div>
            <h2>HDR Result</h2>
            {outputUrl ? (
              <video controls src={outputUrl} className={styles.video} />
            ) : (
              <div className={styles.placeholder}>Converted video will appear here</div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.console}>
        <h3>Processing Log</h3>
        <div className={styles.logArea}>
          {logMessages.length === 0 ? (
            <span className={styles.placeholder}>Conversion steps will appear here.</span>
          ) : (
            <ul>
              {logMessages.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          )}
        </div>

        {outputUrl && (
          <a href={outputUrl} download="hdr-video.mp4" className={styles.downloadButton}>
            Download HDR Video
          </a>
        )}
      </section>
    </main>
  );
}
