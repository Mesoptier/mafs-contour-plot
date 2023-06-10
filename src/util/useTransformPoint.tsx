import { useTransformContext, vec } from 'mafs';
import { useCallback } from 'react';

export function useTransformPoint(): (point: vec.Vector2) => vec.Vector2 {
    const { userTransform, viewTransform } = useTransformContext();
    return useCallback(
        (point: vec.Vector2) =>
            vec.transform(vec.transform(point, userTransform), viewTransform),
        [userTransform, viewTransform],
    );
}
