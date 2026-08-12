import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Ícone da app: quadrado arredondado na cor da sidebar, com o mesmo
 *  símbolo "tendência a subir" usado no cabeçalho — mantém a marca
 *  consistente entre a barra lateral e o separador do browser. */
export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <polyline
            points="3 17 9 11 13 15 21 7"
            stroke="#5b8def"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="14 7 21 7 21 14"
            stroke="#5b8def"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
