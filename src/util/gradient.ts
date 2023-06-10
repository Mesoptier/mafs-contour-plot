export function linearGradient(
    colorStops: [offset: number, color: string][],
    size = 255,
): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = 1;

    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    colorStops.forEach(([offset, color]) =>
        gradient.addColorStop(offset, color),
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, 1);

    return ctx.getImageData(0, 0, size, 1);
}
