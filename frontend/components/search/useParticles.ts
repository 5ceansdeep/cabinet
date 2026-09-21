"use client";

import { useEffect, useRef } from "react";

/* 임베딩 시각화 — 서류 조각과 시안 데이터 입자가 일렁이다 흩어진다.
   canvasRef 를 전체 화면 캔버스에 달고, scatter(rect) 로 rect 테두리에서 입자를 뿜는다. */

type Particle = { x: number; y: number; vx: number; vy: number; life: number; rot: number; scrap: boolean };

export function useParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const resize = () => {
      canvas.width = innerWidth * devicePixelRatio;
      canvas.height = innerHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      particles.current = particles.current.filter((p) => (p.life -= 0.012) > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 - 0.01; // 위로 떠오르는 일렁임
        p.rot += p.vx * 0.05;
        ctx.globalAlpha = p.life;
        if (p.scrap) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = "rgba(226,232,240,.35)";
          ctx.fillRect(-4, -3, 8, 6);
          ctx.restore();
        } else {
          ctx.fillStyle = "#00e5ff";
          ctx.shadowColor = "#00e5ff";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    resize();
    addEventListener("resize", resize);
    tick();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, []);

  function scatter(r: DOMRect) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
  }

  return { canvasRef, scatter };
}
