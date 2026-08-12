import { ImageResponse } from "next/og";

export const dynamic = "force-static";

/** Ícone 192x192 para o manifest da PWA — Android exige pelo menos este
 *  tamanho para o ícone do ecrã principal ficar nítido. Mesmo desenho do
 *  ícone do separador (app/icon.tsx), só maior. */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1220",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
          <polyline
            points="3 17 9 11 13 15 21 7"
            stroke="#5b8def"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="14 7 21 7 21 14"
            stroke="#5b8def"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
