export function subdivideCoords(coords: number[], res: number): number[] {
    const newCoords = [coords[0]];

    for (let coordIdx = 1; coordIdx < coords.length; ++coordIdx) {
        const c1 = coords[coordIdx - 1];
        const c2 = coords[coordIdx];
        const numSubdivisions = Math.ceil((c2 - c1) / res);

        for (let i = 0; i < numSubdivisions; ++i) {
            const t = (i + 1) / numSubdivisions;
            newCoords.push(c1 * (1 - t) + c2 * t);
        }
    }

    return newCoords;
}
