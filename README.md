# Nhi Night Desk

Portfolio của Mã Nam Nhi: một bàn làm việc 3D lúc đêm, camera di chuyển qua từng vật thể theo scroll.
Stack: **Vite + React 18 + TypeScript + React Three Fiber + three.js**.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build ra dist/
npm run preview    # chạy thử bản build
```

## Sửa nội dung

Toàn bộ nội dung nằm trong **`src/content/profile.ts`**: thông tin cá nhân, kinh nghiệm, toolkit.
DOM sections và nội dung trên các màn hình 3D (editor trên monitor, terminal trên laptop, lock screen điện thoại, gáy sách) đều đọc từ file này, nên chỉ cần sửa ở một chỗ.

- Thêm công ty: thêm phần tử vào `experience`. Editor trên monitor tự sinh lại code.
- Muốn một tool xuất hiện thành sách trên kệ: thêm `spine: '#màu'` cho tool đó.

## Cấu trúc

```
src/
  content/profile.ts      Nội dung (single source of truth)
  lib/date.ts             Format ngày, tính số tháng kinh nghiệm
  scene/
    config.ts             Màu, cường độ đèn, camera stops — chỗ tinh chỉnh scene
    state.ts              State mutable cho useFrame (scroll progress, pointer) + timeline intro
    CameraRig.tsx         Camera theo scroll, dolly intro, parallax, setViewOffset
    DeskScene.tsx         Gắn lights + các object
    geometry.ts           createSlab (khối bo góc), createJet (mô hình jet low-poly)
    screens.ts            Vẽ canvas cho editor / terminal / phone / gáy sách
    useCanvasTexture.ts   Hook CanvasTexture + redraw khi font load xong
    interaction.ts        Click vào object → scroll tới section
    objects/              Room, Lamp, Monitor, Laptop, Phone, Mug, Bookshelf, ModelJet
  hooks/
    useScrollStops.ts     Scroll → progress (không re-render mỗi frame)
    useGlobalInput.ts     Pointer parallax, input bất kỳ thì skip intro
  ui/                     Nav, Sections (DOM, tốt cho SEO/a11y)
```

## Quyết định kỹ thuật

- **Không re-render React mỗi frame.** Scroll progress và pointer nằm trong object `sceneState` mutable. Component đọc giá trị này trong `useFrame`. React chỉ re-render khi đổi stop (để highlight nav).
- **Camera stops khai báo trong `config.ts`.** Mỗi `<section data-stop>` tương ứng một stop. Thêm section thì thêm stop, không phải đụng vào logic camera.
- **`setViewOffset`** đẩy vật thể sang một bên để nhường chỗ cho panel text. Trên mobile (≤ 860px) offset về 0 và panel nằm dưới đáy màn hình.
- **Intro** là timeline thuần (`introPower(e)` trong `state.ts`). Lamp, monitor, laptop, phone và camera chỉ đọc giá trị 0…1 tương ứng. Muốn chỉnh nhịp intro, sửa đúng một hàm.
- **Reduced motion:** bỏ intro, tắt parallax và cursor blink, canvas chuyển sang `frameloop="demand"`.
- **Performance:** `dpr` tối đa 1.75, bàn phím 60 phím dùng `InstancedMesh` (1 draw call), chỉ đèn bàn đổ bóng, three.js tách chunk riêng để cache lâu.
- **Lights** dùng đơn vị vật lý (three r155+). Nếu thấy cảnh quá tối hoặc quá sáng trên màn hình của bạn, chỉnh `LIGHTS` trong `config.ts`.

## Model máy bay

`public/models/su57.glb`: Su-57 Felon của [bohmerang](https://sketchfab.com/bohmerang), license **CC BY-NC-SA 4.0** (không dùng thương mại, bản chỉnh sửa phải giữ cùng license, phải ghi credit; credit nằm ở footer). Đã nén từ bản Sketchfab 23MB:

```bash
npx @gltf-transform/cli optimize in.glb public/models/su57.glb --compress meshopt --texture-compress webp --texture-size 1024 --simplify false --join false --flatten false
```

Giữ `--join false --flatten false` để còn tách được node `SU57-landingOn*` / `SU57-landingOff*` (thả/thu bánh khi bay). Jet low-poly trong `geometry.ts` là fallback trong lúc GLB tải.

## Thay mô hình bằng GLB khác

1. Đặt file vào `public/models/…` (nén trước: `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt`)
2. Đổi `MODEL_URL` trong `ModelJet.tsx`; model tự căn giữa và co về dài `LENGTH`. Nếu mũi quay sai hướng, chỉnh `NOSE_YAW`.
3. Nhớ cập nhật credit và license ở footer (`Sections.tsx`).

## Deploy

`npm run build` rồi deploy thư mục `dist/` lên Vercel, Netlify hoặc Cloudflare Pages. Không cần cấu hình gì thêm.
