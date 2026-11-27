import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// O iPhone arredonda os cantos sozinho: o fundo vai reto até a borda.
export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoDataUri({ radius: 0, scale: 0.86 })} width={180} height={180} alt="" />,
    size,
  );
}
