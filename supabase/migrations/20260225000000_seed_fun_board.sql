-- Seed a fun board with various objects
-- This migration creates a "Fun Board 🎉" with colorful sticky notes, shapes, frames, and connectors

-- Create the fun board (using a fixed UUID so it's idempotent)
INSERT INTO boards (id, name, created_by, created_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'Fun Board 🎉', NULL, NOW())
ON CONFLICT (id) DO NOTHING;

-- Clear any existing objects for this board (in case migration is re-run)
DELETE FROM board_objects WHERE board_id = '11111111-1111-1111-1111-111111111111';

-- Insert fun board objects
INSERT INTO board_objects (id, board_id, type, properties, x, y, width, height, z_index, rotation, created_by, updated_at) VALUES
-- Welcome frame
('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'frame', 
 '{"label": "Welcome to Fun Board! 🎉", "strokeColor": "#8b5cf6"}'::jsonb,
 100, 100, 500, 400, 1, 0, NULL, NOW()),

-- Colorful sticky notes
('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'sticky_note',
 '{"text": "Hello! 👋", "color": "#fef08a"}'::jsonb,
 150, 180, 120, 120, 2, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'sticky_note',
 '{"text": "Have fun! 🎨", "color": "#fda4af"}'::jsonb,
 300, 180, 120, 120, 3, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'sticky_note',
 '{"text": "Be creative! ✨", "color": "#93c5fd"}'::jsonb,
 450, 180, 120, 120, 4, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'sticky_note',
 '{"text": "Collaborate! 👥", "color": "#86efac"}'::jsonb,
 150, 320, 120, 120, 5, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'sticky_note',
 '{"text": "Dream big! 🌟", "color": "#fbbf24"}'::jsonb,
 300, 320, 120, 120, 6, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'sticky_note',
 '{"text": "Stay awesome! 💪", "color": "#c084fc"}'::jsonb,
 450, 320, 120, 120, 7, 0, NULL, NOW()),

-- Colorful shapes
('a0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'circle',
 '{"fillColor": "#ec4899", "strokeColor": "#1e293b", "strokeWidth": 3}'::jsonb,
 700, 200, 100, 100, 8, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'rectangle',
 '{"fillColor": "#3b82f6", "strokeColor": "#1e293b", "strokeWidth": 3}'::jsonb,
 700, 350, 150, 100, 9, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'circle',
 '{"fillColor": "#10b981", "strokeColor": "#1e293b", "strokeWidth": 3}'::jsonb,
 900, 200, 80, 80, 10, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'rectangle',
 '{"fillColor": "#f59e0b", "strokeColor": "#1e293b", "strokeWidth": 3}'::jsonb,
 900, 350, 120, 120, 11, 15, NULL, NOW()),

-- Text elements
('a0000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'text',
 '{"text": "Made with ❤️ for you!", "color": "#1e293b", "fontSize": 24, "fontWeight": "bold"}'::jsonb,
 200, 550, 300, 40, 12, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'text',
 '{"text": "Enjoy exploring! 🚀", "color": "#8b5cf6", "fontSize": 20}'::jsonb,
 700, 550, 250, 32, 13, 0, NULL, NOW()),

-- Connectors between sticky notes
('a0000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'connector',
 '{"strokeColor": "#64748b", "strokeWidth": 2, "startObjectId": "a0000000-0000-0000-0000-000000000002", "endObjectId": "a0000000-0000-0000-0000-000000000003"}'::jsonb,
 210, 240, 90, 0, 14, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'connector',
 '{"strokeColor": "#64748b", "strokeWidth": 2, "startObjectId": "a0000000-0000-0000-0000-000000000003", "endObjectId": "a0000000-0000-0000-0000-000000000004"}'::jsonb,
 330, 240, 90, 0, 15, 0, NULL, NOW()),

-- Decorative lines
('a0000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'line',
 '{"strokeColor": "#cbd5e1", "strokeWidth": 2}'::jsonb,
 650, 150, 200, 0, 16, 0, NULL, NOW()),

('a0000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 'line',
 '{"strokeColor": "#cbd5e1", "strokeWidth": 2}'::jsonb,
 650, 500, 200, 0, 17, 0, NULL, NOW());
