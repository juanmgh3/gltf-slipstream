// Before/after 3D compare (T16), behind a component seam: the mode union covers
// side-by-side / slider / toggle (the shipped choice was made on
// the rendered UI); only side-by-side is implemented until that verdict.
// Re-rendering the optimized GLB in model-viewer IS the correctness check.
// model-viewer is imported dynamically — it registers a custom element and pulls
// its own three.js, none of which the load path should pay for. Its DRACO decoder
// is self-hosted under /mv-draco/ (postinstall) — never Google's CDN.

import { useEffect, useState } from 'preact/hooks';

export type CompareMode = 'side-by-side' | 'slider' | 'toggle';

interface CompareViewerProps {
  original: File;
  optimizedGlb: ArrayBuffer;
  mode?: CompareMode;
}

export function CompareViewer({ original, optimizedGlb }: CompareViewerProps) {
  const [urls, setUrls] = useState<{ before: string; after: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string[] = [];
    (async () => {
      // model-viewer's element constructor reads `self.ModelViewerElement` — the
      // global config object, NOT the imported class — and resets the decoder
      // location from it with a gstatic fallback (lib/features/loading.js), so a
      // static set on the class is silently overwritten. Configure the global.
      const configHost = self as { ModelViewerElement?: { dracoDecoderLocation?: string } };
      configHost.ModelViewerElement = {
        ...configHost.ModelViewerElement,
        dracoDecoderLocation: new URL('/mv-draco/', location.origin).href,
      };
      await import('@google/model-viewer');
      const before = URL.createObjectURL(new Blob([await original.arrayBuffer()], { type: 'model/gltf-binary' }));
      const after = URL.createObjectURL(new Blob([optimizedGlb], { type: 'model/gltf-binary' }));
      created = [before, after];
      if (cancelled) created.forEach((url) => URL.revokeObjectURL(url));
      else setUrls({ before, after });
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [original, optimizedGlb]);

  if (!urls) return <p class="cv-loading">Preparing 3D compare…</p>;

  return (
    <div class="compare" data-testid="compare">
      <figure class="cv-pane">
        <model-viewer class="cv-viewer" src={urls.before} alt="Original model" camera-controls />
        <figcaption class="cv-label">Before</figcaption>
      </figure>
      <figure class="cv-pane">
        <model-viewer class="cv-viewer" src={urls.after} alt="Optimized model" camera-controls />
        <figcaption class="cv-label cv-label-after">After</figcaption>
      </figure>
    </div>
  );
}
