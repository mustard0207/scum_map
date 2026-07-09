const code = 'SCUM#VgUQjEBzgOB/sT6AAAJqTHInAv93wJfBQt/fjTMAA2pMdZr/xfeTAeDclDEAAmpMfO4G//+gpN0Y38fFIwADakx9FODrvCL/w7pwAANqOgjl';

const payload = code.substring(5);
const buf = Buffer.from(payload, 'base64');
const bytes = new Uint8Array(buf);

function _readInt40(bytes, offset) {
  const b0 = bytes[offset]
  const b1 = bytes[offset + 1]
  const b2 = bytes[offset + 2]
  const b3 = bytes[offset + 3]
  const b4 = bytes[offset + 4]
  const lo32 = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
  const hi8 = b4 & 0x7F
  const sign = (b4 & 0x80) ? -1 : 1
  const value = sign * (hi8 * 0x100000000 + (lo32 >>> 0))
  return value
}

function _zigzagDecode(value) {
  return (value & 1) === 0 ? value / 2 : -(value + 1) / 2
}

function _readVarint(bytes, offset) {
  let result = 0
  let factor = 1
  let pos = offset
  while (pos < bytes.length) {
    const b = bytes[pos]
    result += (b & 0x7F) * factor
    pos++
    if ((b & 0x80) === 0) break
    factor *= 128
  }
  return [result, pos - offset]
}

function _bytesToStr(bytes) {
  let uri = ''
  for (let i = 0; i < bytes.length; i++) {
    uri += '%' + ('0' + bytes[i].toString(16)).slice(-2)
  }
  return decodeURIComponent(uri)
}

function decodeBinaryMarkers(bytes, hasType, hasCreatedAt, hasVehicleParts) {
  const count = bytes[1]
  if (count === 0) return []
  const markers = []
  let pos = 2
  let prevLngInt = 0
  let prevLatInt = 0
  const typeMap = { 1: 'house', 2: 'vehicle', 3: 'box' }

  for (let i = 0; i < count && pos < bytes.length; i++) {
    console.log(`--- Marker ${i} ---`)
    let lngInt, latInt

    if (i === 0) {
      lngInt = _readInt40(bytes, pos); pos += 5
      latInt = _readInt40(bytes, pos); pos += 5
    } else {
      const [dLngRaw, c1] = _readVarint(bytes, pos); pos += c1
      const [dLatRaw, c2] = _readVarint(bytes, pos); pos += c2
      lngInt = prevLngInt + _zigzagDecode(dLngRaw)
      latInt = prevLatInt + _zigzagDecode(dLatRaw)
    }
    console.log('lngInt:', lngInt, 'latInt:', latInt)

    prevLngInt = lngInt
    prevLatInt = latInt

    const [nameLen, c3] = _readVarint(bytes, pos); pos += c3
    let name = ''
    if (nameLen > 0 && pos + nameLen <= bytes.length) {
      name = _bytesToStr(bytes.slice(pos, pos + nameLen))
      pos += nameLen
    }
    console.log('name:', name)

    let typeCode = 0
    let type = ''
    if (hasType && pos < bytes.length) {
      typeCode = bytes[pos]
      type = typeMap[typeCode] || ''
      pos++
    }
    console.log('typeCode:', typeCode, 'type:', type)

    let createdAt = Math.floor(Date.now() / 1000)
    if (hasCreatedAt && pos + 4 <= bytes.length) {
      createdAt = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0
      pos += 4
      if (createdAt <= 0) createdAt = Math.floor(Date.now() / 1000)
    }
    console.log('createdAt:', createdAt)
    
    let vehicleId = 0
    let partsMask = 0xFFFF
    if (hasVehicleParts && typeCode === 2 && pos + 3 <= bytes.length) {
      vehicleId = bytes[pos]
      partsMask = (bytes[pos + 1] << 8) | bytes[pos + 2]
      pos += 3
    }
    console.log('vehicleId:', vehicleId, 'partsMask:', partsMask)

    markers.push({
      lng: lngInt / 10000,
      lat: latInt / 10000,
      name,
      type,
      vehicleId,
      partsMask,
      createdAt
    })
  }
  return markers
}

try {
    console.log("bytes length:", bytes.length, "bytes[0]:", bytes[0]);
    let result = decodeBinaryMarkers(bytes, bytes[0] >= 0x54, bytes[0] >= 0x55, bytes[0] >= 0x56);
    console.log(result);
} catch (e) {
    console.error("Error:", e);
}
