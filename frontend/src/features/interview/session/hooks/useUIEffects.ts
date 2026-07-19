import { useCallback } from "react";
import toast from "react-hot-toast";
import type { BannerOptions } from "features/interview/types";

export const useUIEffects = (optionsRef: React.MutableRefObject<BannerOptions | null>) => {
  const addBanner = useCallback(
    (type: string, message: string, autoDismissMs: number | null = null) => {
      const fn = optionsRef.current?.addBanner;
      if (typeof fn !== "function") return null;
      return fn(type, message, autoDismissMs ?? null);
    },
    [optionsRef]
  );

  const removeBanner = useCallback(
    (id: number) => {
      const fn = optionsRef.current?.removeBanner;
      if (typeof fn === "function") fn(id);
    },
    [optionsRef]
  );

  const removeBannerByType = useCallback(
    (type: string) => {
      const fn = optionsRef.current?.removeBannerByType;
      if (typeof fn === "function") fn(type);
    },
    [optionsRef]
  );

  return {
    toast,
    addBanner,
    removeBanner,
    removeBannerByType,
  };
};
