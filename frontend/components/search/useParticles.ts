"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/motion";

/* 임베딩 시각화 — 종이 조각과 그림자색 입자가 일렁이다 흩어진다 (흰 편지 화면용).
   canvasRef 를 전체 화면 캔버스에 달고, scatter(rect) 로 rect 테두리에서 입자를 뿜는다. */

type Particle = { x: number; y: number; vx: number; vy: number; life: number; rot: number; scrap: boolean };

export function useParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const wake = useRef<() => void>(() => {}); // 쉬던 루프를 다시 돌린다 — 입자가 없으면 루프도 멈춘다

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = 0;
    // 영화 프레임 안이라 창 크기가 아니라 캔버스 자신의 크기로 잡는다
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    // 60Hz 한 프레임을 1 로 센 경과 — 120Hz 모니터에서도 같은 속도로 흩어진다
    const tick = (now: number) => {
      const f = last ? Math.min(3, (now - last) / (1000 / 60)) : 1;
      last = now;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      particles.current = particles.current.filter((p) => (p.life -= 0.012 * f) > 0);
      const drag = 0.985 ** f;
      for (const p of particles.current) {
        p.x += p.vx * f;
        p.y += p.vy * f;
        p.vx *= drag;
        p.vy = p.vy * drag - 0.01 * f; // 위로 떠오르는 일렁임
        p.rot += p.vx * 0.05 * f;
        ctx.globalAlpha = p.life;
        if (p.scrap) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = "rgba(0,0,0,.08)";
          ctx.fillRect(-4, -3, 8, 6);
          ctx.restore();
        } else {
          ctx.fillStyle = "rgba(0,0,0,.25)";
          ctx.shadowColor = "rgba(0,0,0,.15)";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      // 입자가 다 사라지면 쉰다 — 빈 캔버스를 매 프레임 지우지 않게
      raf = particles.current.length ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    wake.current = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    resize();
    addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, []);

  function scatter(box: DOMRect) {
    if (reducedMotion()) return; // 움직임 줄이기 — 입자를 안 뿜으니 루프도 안 돈다
    // 폼 위치(화면 좌표)를 캔버스 좌표로 — 영화 프레임만큼 밀려 있다
    const at = canvasRef.current!.getBoundingClientRect();
    const r = new DOMRect(box.left - at.left, box.top - at.top, box.width, box.height);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 6; i++) {
      // 테두리 위 임의의 점에서 바깥으로
      const t = Math.random();
      const edge = Math.floor(Math.random() * 4);
      const x = edge < 2 ? r.left + t * r.width : edge === 2 ? r.left : r.right;
      const y = edge === 0 ? r.top : edge === 1 ? r.bottom : r.top + t * r.height;
      const d = Math.hypot(x - cx, y - cy) || 1;
      const speed = 0.4 + Math.random() * 1.2;
      particles.current.push({
        x,
        y,
        vx: ((x - cx) / d) * speed + (Math.random() - 0.5) * 0.6,
        vy: ((y - cy) / d) * speed + (Math.random() - 0.5) * 0.6,
        life: 1,
        rot: Math.random() * Math.PI,
        scrap: Math.random() < 0.3,
      });
    }
    wake.current();
  }

  return { canvasRef, scatter };
}
