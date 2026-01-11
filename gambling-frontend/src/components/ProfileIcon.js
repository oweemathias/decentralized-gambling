import React, { useState } from "react";
import ProfilePanel from "./ProfilePanel";

export default function ProfileIcon() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          borderRadius: "50%",
          width: 40,
          height: 40,
          fontSize: 18
        }}
      >
        👤
      </button>

      {open && <ProfilePanel onClose={() => setOpen(false)} />}
    </>
  );
}
