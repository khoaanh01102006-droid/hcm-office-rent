/* =========================================================================
   LỚP TIA HỘI TỤ — hiệu ứng động trên bản đồ

   Ba nghìn tia, mỗi tia nối MỘT TRẠM XE BUÝT THẬT với ga metro mà từ đó tới
   được nhanh nhất. Hạt sáng chạy dọc tia theo hướng trạm → ga.

   ĐIỀU PHẢI NÓI RÕ: đường cong là TRANG TRÍ, không phải lộ trình xe buýt.
   Thứ có thật là hai đầu tia, thời gian đi và số tuyến qua trạm. Vẽ một
   đường cong rồi để người xem tưởng đó là tuyến đường sẽ là nói dối bằng
   hình. Câu này in thẳng vào giao diện, không giấu trong tệp dữ liệu.

   VÌ SAO CANVAS CHỨ KHÔNG PHẢI LỚP CỦA MAPLIBRE:
   MapLibre vẽ đường rất tốt nhưng không có khái niệm "hạt chạy dọc đường".
   Làm bằng `line-dasharray` động thì mỗi khung hình phải gọi
   setPaintProperty — tốn, và không tạo được vệt sáng mờ dần. Canvas 2D với
   chế độ hoà sáng cộng (`lighter`) cho đúng thứ cần: chồng nhiều tia lên
   nhau thì chỗ dày sáng rực lên, tức là ĐỘ SÁNG TỰ NÓ MANG THÔNG TIN về mức
   độ tập trung, không cần vẽ thêm gì.

   HIỆU NĂNG. 3.062 tia × 60 khung hình. Ba việc giữ cho nó mượt:
     1. Gom theo dải màu: bốn lần `stroke()` cho cả nghìn tia, không phải
        một lần cho mỗi tia.
     2. Cắt bớt theo khung nhìn trước khi vẽ.
     3. `quadraticCurveTo` một lệnh cho cả cung, không lấy mẫu tay.

   prefers-reduced-motion: vẽ tia tĩnh, không hạt. Chuyển động là gia vị.
   ========================================================================= */

/* Màu theo phút tới ga — cùng thang với các bản đồ thời gian khác, để người
   đọc không phải học một bảng màu mới. */
const FLOW_BANDS = [
  { max: 15, rgb: [56, 189, 248], label: 'dưới 15 phút' },
  { max: 30, rgb: [74, 222, 128], label: '15 – 30 phút' },
  { max: 45, rgb: [251, 146, 60], label: '30 – 45 phút' },
  { max: 999, rgb: [225, 29, 107], label: 'trên 45 phút' },
];

const bandOf = (min) => {
  for (let i = 0; i < FLOW_BANDS.length; i++) if (min <= FLOW_BANDS[i].max) return i;
  return FLOW_BANDS.length - 1;
};

export const FLOW_LEGEND = FLOW_BANDS.map((b) => ({
  color: 'rgb(' + b.rgb.join(',') + ')', label: b.label,
}));

/* ĐOÀN TÀU CHẠY DỌC TUYẾN.

   Không phải một chấm trượt đều: tàu TĂNG TỐC rời ga, chạy đều, HÃM trước
   ga rồi DỪNG một nhịp. Chuyển động đều trông giả ngay lập tức vì mắt người
   quen với việc phương tiện phải dừng đón khách — và chính nhịp dừng ấy làm
   người xem đọc ra "đây là mười bốn ga", không cần đếm.

   Vị trí tính theo CHIỀU DÀI DỒN trên đường ray đã ghép, nên tàu bám đúng
   khúc cong thay vì cắt góc. Hai đoàn chạy ngược chiều nhau.

   Tốc độ ở đây là TỐC ĐỘ TRÌNH DIỄN (chạy hết tuyến ~40 giây), không phải
   biểu đồ chạy tàu thật — đã ghi trong _gaps của tệp dữ liệu. */
function makeTrain(metro, dir) {
  const stops = (metro.stations || []).map((x) => x.at).sort((a, b) => a - b);
  const L = metro.lengthM || 1;
  return {
    dir,
    s: dir > 0 ? 0 : L,
    v: 0,
    dwell: 0,
    // Chỉ số ga kế tiếp theo chiều đang chạy.
    nextIdx: dir > 0 ? 0 : stops.length - 1,
    stops, L,
  };
}

const V_MAX = 700;        // mét đường ray mỗi giây (tốc độ trình diễn)
const A = 900;            // gia tốc / gia tốc hãm
const DWELL_S = 0.75;     // thời gian dừng ở ga

function stepTrain(t, dt) {
  if (t.dwell > 0) {
    t.dwell -= dt;
    if (t.dwell <= 0) t.nextIdx += t.dir;   // rời ga, nhắm ga kế
    return;
  }
  const target = t.stops[t.nextIdx];
  if (target == null) {                      // hết tuyến: quay đầu
    t.dir = -t.dir;
    t.nextIdx = t.dir > 0 ? 0 : t.stops.length - 1;
    t.v = 0;
    return;
  }
  const left = Math.max(0, (target - t.s) * t.dir);
  /* Quãng đường cần để hãm từ tốc độ hiện tại về 0: v²/2a. So nó với quãng
     còn lại là cách duy nhất để tàu dừng ĐÚNG ở ga chứ không vọt qua. */
  const brakeDist = (t.v * t.v) / (2 * A);
  if (left <= brakeDist + 1) t.v = Math.max(0, t.v - A * dt);
  else t.v = Math.min(V_MAX, t.v + A * dt);
  t.s += t.v * dt * t.dir;
  if (left <= 4 && t.v < 40) { t.s = target; t.v = 0; t.dwell = DWELL_S; }
  t.s = Math.max(0, Math.min(t.L, t.s));
}

/* Toạ độ tại chiều dài dồn `d`, nội suy tuyến tính giữa hai đỉnh. */
function atDist(metro, d) {
  const cum = metro.cum, line = metro.line;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const span = cum[hi] - cum[lo] || 1;
  const t = Math.max(0, Math.min(1, (d - cum[lo]) / span));
  return [
    line[lo][0] + (line[hi][0] - line[lo][0]) * t,
    line[lo][1] + (line[hi][1] - line[lo][1]) * t,
  ];
}

export function createFlowLayer(map, host, data, metro) {
  const canvas = document.createElement('canvas');
  canvas.className = 'story__flow';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  const stations = data.stations || [];
  /* Chuẩn hoá một lần, không phải mỗi khung hình. `w` là trọng số vẽ suy từ
     số tuyến qua trạm: một trạm hai mươi tuyến phải sáng hơn hẳn trạm một
     tuyến, nhưng không được sáng gấp hai mươi lần — căn bậc hai nén dải lại
     để trạm dày không nuốt hết phần còn lại. */
  const maxRoutes = Math.max(1, ...data.flows.map((f) => f[4]));
  const arcs = data.flows.map(([lng, lat, st, min, nr]) => ({
    lng, lat, st, min, nr,
    band: bandOf(min),
    w: Math.sqrt(nr / maxRoutes),
    // Pha ban đầu rải đều để hạt không chạy thành từng đợt đồng loạt.
    phase: Math.random(),
  }));

  const trains = metro?.line?.length ? [makeTrain(metro, 1), makeTrain(metro, -1)] : [];
  let lastT = 0;
  let raf = 0, running = false, t0 = 0;
  let wantFlows = false, wantTrain = false;
  let dpr = 1, W = 0, H = 0;
  let alpha = 0;                 // độ hiện của lớp TIA
  let target = 0;
  let alphaTrain = 0;            // độ hiện của ĐOÀN TÀU, tách riêng
  let targetTrain = 0;
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* Điểm điều khiển của cung: lệch VUÔNG GÓC với đoạn thẳng, độ nhô tỉ lệ
     với chiều dài. Cung ngắn gần như thẳng, cung dài vồng cao — nhờ vậy hàng
     nghìn tia đổ về cùng một ga không chồng khít lên nhau thành một vệt. */
  function control(ax, ay, bx, by) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const lift = Math.min(len * 0.22, 160);
    return [mx - (dy / len) * lift, my + (dx / len) * lift];
  }

  const bez = (a, c, b, t) => {
    const u = 1 - t;
    return u * u * a + 2 * u * t * c + t * t * b;
  };

  function frame(now) {
    if (!running && alpha <= 0.001 && alphaTrain <= 0.001) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;

    // Mờ dần vào/ra để lớp không bật tắt đột ngột khi đổi bước.
    alpha += (target - alpha) * 0.08;
    alphaTrain += (targetTrain - alphaTrain) * 0.08;
    ctx.clearRect(0, 0, W, H);
    if (alpha <= 0.003 && alphaTrain <= 0.003) return;

    const sp = stations.map((s) => map.project([s.lng, s.lat]));
    const still = reduced();

    // Gom theo dải màu: bốn lượt stroke thay vì ba nghìn.
    for (let b = 0; alpha > 0.003 && b < FLOW_BANDS.length; b++) {
      const [r, gg, bl] = FLOW_BANDS[b].rgb;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(' + r + ',' + gg + ',' + bl + ',' + (0.14 * alpha) + ')';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      let drawn = 0;
      for (const a of arcs) {
        if (a.band !== b) continue;
        const s = sp[a.st];
        if (!s) continue;
        const p = map.project([a.lng, a.lat]);
        // Cắt bớt: bỏ tia mà CẢ HAI đầu đều ngoài khung, nới 200 px.
        if ((p.x < -200 || p.x > W + 200 || p.y < -200 || p.y > H + 200)
          && (s.x < -200 || s.x > W + 200 || s.y < -200 || s.y > H + 200)) continue;
        const [cx, cy] = control(p.x, p.y, s.x, s.y);
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(cx, cy, s.x, s.y);
        a._p = p; a._c = [cx, cy]; a._s = s;    // dùng lại cho hạt
        drawn++;
      }
      if (drawn) ctx.stroke();

      // Hạt sáng chạy dọc tia. Một path cho cả dải.
      if (!still) {
        ctx.fillStyle = 'rgba(' + r + ',' + gg + ',' + bl + ',' + (0.9 * alpha) + ')';
        ctx.beginPath();
        for (const a of arcs) {
          if (a.band !== b || !a._p) continue;
          /* Hạt chạy chậm hơn khi chuyến đi lâu hơn: thời gian đi ĐƯỢC MÃ
             HOÁ CẢ VÀO TỐC ĐỘ, không chỉ vào màu. Người xem cảm được "xa"
             trước khi kịp đọc chú giải. */
          const speed = 0.16 + 0.5 / (1 + a.min / 12);
          const u = (a.phase + t * speed) % 1;
          const x = bez(a._p.x, a._c[0], a._s.x, u);
          const y = bez(a._p.y, a._c[1], a._s.y, u);
          const rr = 0.7 + 1.9 * a.w;
          ctx.moveTo(x + rr, y);
          ctx.arc(x, y, rr, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.restore();
      for (const a of arcs) a._p = null;
    }

    /* ---- ĐOÀN TÀU ---- */
    if (wantTrain && trains.length) {
      const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
      for (const tr of trains) {
        if (!still) stepTrain(tr, dt);
        const head = atDist(metro, tr.s);
        const p = map.project(head);
        /* Vệt đuôi: lấy mẫu ngược 260 m, mờ dần. Vệt cho biết HƯỚNG chạy mà
           không cần vẽ mũi tên, và nó là thứ khiến chuyển động đọc được ngay
           cả khi mắt không bắt kịp đầu tàu. */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let k = 1; k <= 6; k++) {
          const d = tr.s - tr.dir * (k * 44);
          if (d < 0 || d > tr.L) break;
          const q = map.project(atDist(metro, d));
          const prev = map.project(atDist(metro, d + tr.dir * 44));
          ctx.strokeStyle = 'rgba(240,171,252,' + (0.5 * alphaTrain * (1 - k / 7)) + ')';
          ctx.lineWidth = 6 - k * 0.7;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        // Quầng sáng đầu tàu.
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
        glow.addColorStop(0, 'rgba(255,255,255,' + (0.95 * alphaTrain) + ')');
        glow.addColorStop(0.3, 'rgba(240,171,252,' + (0.55 * alphaTrain) + ')');
        glow.addColorStop(1, 'rgba(240,171,252,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + alphaTrain + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      lastT = now;
    } else lastT = 0;

    /* Vòng sáng ở ga, to theo SỐ TRẠM thuộc về ga đó. Đây là "mức độ tập
       trung" nói thẳng ra bằng kích thước, thay vì bắt người xem tự đếm tia. */
    const maxStops = Math.max(1, ...stations.map((s) => s.stops || 0));
    if (alpha > 0.003) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    stations.forEach((s, i) => {
      const p = sp[i];
      if (!p || p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) return;
      const k = Math.sqrt((s.stops || 0) / maxStops);
      const base = 5 + 26 * k;
      const pulse = still ? 0 : (Math.sin(t * 1.6 + i * 0.7) * 0.5 + 0.5);
      const rad = base * (1 + 0.22 * pulse);
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,' + (0.5 * alpha) + ')');
      grd.addColorStop(0.35, 'rgba(240,171,252,' + (0.3 * alpha) + ')');
      grd.addColorStop(1, 'rgba(240,171,252,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    }
  }

  return {
    /* Hai lớp bật/tắt ĐỘC LẬP: cảnh tuyến metro cần tàu mà không cần tia,
       cảnh phễu cần cả hai. Gộp làm một cờ sẽ mất một trong hai cách dùng. */
    show(opts) {
      const o = typeof opts === 'boolean' ? { flows: opts } : (opts || {});
      wantFlows = !!o.flows; wantTrain = !!o.train;
      target = wantFlows ? 1 : 0;
      targetTrain = wantTrain ? 1 : 0;
      running = wantFlows || wantTrain;
      if (running) canvas.style.display = 'block';
      if (!raf) raf = requestAnimationFrame(frame);
    },
    destroy() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.remove();
    },
  };
}
