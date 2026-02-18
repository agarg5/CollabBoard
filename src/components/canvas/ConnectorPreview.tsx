import { Line } from 'react-konva'

interface ConnectorPreviewProps {
  start: { x: number; y: number }
  end: { x: number; y: number }
}

export function ConnectorPreview({ start, end }: ConnectorPreviewProps) {
  return (
    <Line
      points={[start.x, start.y, end.x, end.y]}
      dash={[8, 4]}
      stroke="#3b82f6"
      strokeWidth={2}
      listening={false}
    />
  )
}
