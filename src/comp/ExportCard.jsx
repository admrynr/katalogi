import React, { forwardRef } from "react";

const ExportCard = forwardRef(({ product }, ref) => {
  if (!product) return null;

  return (
    <div
      ref={ref}
      className="w-[1080px] h-[1920px] bg-white flex flex-col p-16"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* IMAGE */}
      <div className="w-full h-[1200px] rounded-3xl overflow-hidden bg-gray-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="mt-10 flex flex-col gap-4">
        <p className="text-4xl text-gray-400">{product.code}</p>

        <h1 className="text-6xl font-bold leading-tight">
          {product.name}
        </h1>

        <p className="text-4xl text-gray-500">
          {product.brands?.name || "—"}
        </p>

        <p className="text-5xl font-extrabold mt-6">
          Rp{Number(product.price).toLocaleString("id-ID")}
        </p>
      </div>

      {/* FOOTER / BRAND */}
      <div className="mt-auto text-center text-3xl text-gray-400">
        katalogin.app
      </div>
    </div>
  );
});

export default ExportCard;
