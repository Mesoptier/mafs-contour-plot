import { useTransformContext, vec } from 'mafs';
import { useMemo } from 'react';

export function useScale(): vec.Vector2 {
    const { userTransform, viewTransform } = useTransformContext();
    const scale: vec.Vector2 = [
        Math.abs(viewTransform[0]) * Math.abs(userTransform[0]),
        Math.abs(viewTransform[4]) * Math.abs(userTransform[4]),
    ];
    return useMemo(() => scale, scale);
}
