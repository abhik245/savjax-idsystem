# App V2 Verified Checklist

## Environment
- API: `apps/api` on `http://localhost:4000/api/v2`
- Web: `apps/web` on `http://localhost:3000`

## Runtime Checks Completed
- Company login endpoint works.
- School login endpoint works.
- Parent OTP send/verify endpoints work.
- Dashboard summary endpoint works.
- School CRUD endpoint works.
- Intake link create + public fetch by token works.
- Invoice create + list works.
- Parent submission create + list works.
- Web routes respond:
  - `/login`
  - `/dashboard`
  - `/parent/intake?token=<TOKEN>`

## Role Login Credentials (tested)
- `main.admin@demo.com / Admin@123` -> `SUPER_ADMIN`
- `sales@demo.com / Admin@123` -> `SALES`
- `printer@demo.com / Admin@123` -> `PRINTING`
- `school.admin@demo.com / Admin@123` -> `SCHOOL_ADMIN`
- Parent OTP in dev: `123456`

## Dashboard Features Verified
- Left sidebar is clickable.
- Search bar is editable.
- Role-based menu visibility is active.
- Sales/Admin can add school.
- Sales/Admin can generate invoice.
- Workflow section can generate intake link with photo background preference.

## Parent Panel Features Verified
- Mobile-first step flow.
- OTP login flow.
- Camera open + device switch (front/back depending on device support).
- Live guidance text (face center + brightness).
- Capture + preview + submit.
- Sibling add flow after submit.

## Known Current Constraints
- Face guidance uses browser `FaceDetector` when available; behavior depends on browser support.
- Background normalization is best-effort portrait normalization for demo; production-quality segmentation needs a dedicated model/service.
- Legacy folders (`front end`, `src` old stack) are not deleted yet to avoid accidental data loss.

