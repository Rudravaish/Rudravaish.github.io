"""Keep only the avatar's web animation clips and skeleton from the source GLB."""
import copy
import json
import os
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = Path(os.environ.get('QUATERNIUS_ASSETS', str(ROOT / 'asset-sources')))
SOURCE = SOURCES / 'animations/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'
DEST = ROOT / 'public/assets/rudra-animations.glb'
DEST.parent.mkdir(parents=True, exist_ok=True)
CLIPS = {'Idle_Loop', 'Walk_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Interact'}

with SOURCE.open('rb') as source:
    magic, version, length = struct.unpack('<4sII', source.read(12))
    assert magic == b'glTF' and version == 2
    json_length, json_type = struct.unpack('<II', source.read(8))
    assert json_type == 0x4E4F534A
    gltf = json.loads(source.read(json_length))
    bin_length, bin_type = struct.unpack('<II', source.read(8))
    assert bin_type == 0x004E4942
    binary = source.read(bin_length)

animation_data = copy.deepcopy([clip for clip in gltf['animations'] if clip['name'] in CLIPS])
assert {clip['name'] for clip in animation_data} == CLIPS
new_accessors = []
new_views = []
new_binary = bytearray()
accessor_ids = {}
view_ids = {}

def transfer_accessor(old_id):
    if old_id in accessor_ids:
        return accessor_ids[old_id]
    accessor = copy.deepcopy(gltf['accessors'][old_id])
    if 'sparse' in accessor:
        raise ValueError('Sparse animation accessors need a separate copy path')
    old_view = accessor['bufferView']
    if old_view not in view_ids:
        view = copy.deepcopy(gltf['bufferViews'][old_view])
        assert view['buffer'] == 0
        start = view.get('byteOffset', 0)
        new_offset = len(new_binary)
        new_binary.extend(binary[start:start + view['byteLength']])
        new_binary.extend(b'\0' * (-len(new_binary) % 4))
        view['byteOffset'] = new_offset
        view_ids[old_view] = len(new_views)
        new_views.append(view)
    accessor['bufferView'] = view_ids[old_view]
    accessor_ids[old_id] = len(new_accessors)
    new_accessors.append(accessor)
    return accessor_ids[old_id]

for clip in animation_data:
    for sampler in clip['samplers']:
        sampler['input'] = transfer_accessor(sampler['input'])
        sampler['output'] = transfer_accessor(sampler['output'])

# Every animation target is in the 65-bone hierarchy rooted at node 64.
assert all(channel['target']['node'] < 65 for clip in animation_data for channel in clip['channels'])
web_gltf = {
    'asset': gltf['asset'],
    'scene': 0,
    'scenes': [{'nodes': [64]}],
    'nodes': gltf['nodes'][:65],
    'buffers': [{'byteLength': len(new_binary)}],
    'bufferViews': new_views,
    'accessors': new_accessors,
    'animations': animation_data,
}
json_bytes = json.dumps(web_gltf, separators=(',', ':')).encode()
json_bytes += b' ' * (-len(json_bytes) % 4)
length = 12 + 8 + len(json_bytes) + 8 + len(new_binary)
with DEST.open('wb') as destination:
    destination.write(struct.pack('<4sII', b'glTF', 2, length))
    destination.write(struct.pack('<II', len(json_bytes), 0x4E4F534A))
    destination.write(json_bytes)
    destination.write(struct.pack('<II', len(new_binary), 0x004E4942))
    destination.write(new_binary)
print(f'{DEST}: {len(animation_data)} clips, {len(new_accessors)} accessors, {length:,} bytes')
