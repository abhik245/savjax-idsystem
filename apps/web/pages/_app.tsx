import type { AppProps } from "next/app";

export default function LegacyAppShim({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
