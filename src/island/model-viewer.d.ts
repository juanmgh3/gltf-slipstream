// JSX typing for the <model-viewer> custom element (registered by the dynamic
// import in CompareViewer). Only the attributes we actually use.
import 'preact';

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': JSX.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean;
      };
    }
  }
}
