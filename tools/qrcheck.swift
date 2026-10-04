// Проверка QR в отрендеренном PDF: распознаёт коды CoreImage-детектором и сохраняет кроп.
// swift tools/qrcheck.swift <png> <x> <y> <w> <h> <out.png>
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil)!
let full = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let r = CGRect(x: Double(a[2])!, y: Double(a[3])!, width: Double(a[4])!, height: Double(a[5])!)
let crop = full.cropping(to: r)!

let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[6]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, crop, nil)
CGImageDestinationFinalize(dest)

let det = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let found = det.features(in: CIImage(cgImage: crop)).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
print("found \(found.count): \(found)")
