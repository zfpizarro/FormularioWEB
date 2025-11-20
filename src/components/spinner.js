import React, { useState, useEffect } from "react";

export default function SPLoader() {
  const [text, setText] = useState("Loading");
  const [showImg, setShowImg] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setText(
        "¿Cargando por más de 3s? Intenta recargar la página o contacta a soporte técnico."
      );
    }, 3000);

    return () => clearTimeout(timer); // limpia el timeout al desmontar
  }, []);

  return (
    <div>
      {showImg && <img src="/spinner.gif" alt="Loading..." />}
      <p>{text}</p>
    </div>
  );
}
