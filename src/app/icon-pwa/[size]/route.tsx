import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo";

// Ícones PNG do manifesto: /icon-pwa/192, /icon-pwa/512 e a versão maskable
// (/icon-pwa/maskable-512), com o desenho dentro da área segura do Android.
const SIZES: Record<string, { px: number; maskable: boolean }> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "maskable-512": { px: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}
export const dynamicParams = false;

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const s = SIZES[(await params).size];
  if (!s) return new Response("Not found", { status: 404 });
  const src = s.maskable ? logoDataUri({ radius: 0, scale: 0.7 }) : logoDataUri();
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={s.px} height={s.px} alt="" />,
    { width: s.px, height: s.px },
  );
}
