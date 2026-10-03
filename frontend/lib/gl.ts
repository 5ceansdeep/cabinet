/* GPU 가 3D 컨텍스트를 끊어도(탭을 오래 열어두거나 개발 중 새로고침이 쌓이면 일어난다) 되살린다 — <Canvas onCreated={keepContext}>.
   preventDefault 를 하지 않으면 브라우저가 아예 복구를 포기해 화면이 그 자리에서 멎는다 */
export function keepContext({ gl, invalidate }: { gl: { domElement: HTMLCanvasElement }; invalidate: () => void }) {
  const c = gl.domElement;
  c.addEventListener("webglcontextlost", (e) => e.preventDefault());
  c.addEventListener("webglcontextrestored", () => invalidate());
}
