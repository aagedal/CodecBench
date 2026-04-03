use crate::models::{CodecFamily, EncoderDef, EncoderType, QualityPreset};

/// Build the ffmpeg encoding arguments for a given encoder + preset combination.
/// Returns the args to place between `-i input` and `-y output`.
pub fn build_encode_args(encoder: &EncoderDef, preset: &QualityPreset) -> Vec<String> {
    match (&encoder.encoder_type, &encoder.codec_family, encoder.name.as_str()) {
        // ── Software encoders ──────────────────────────────────────────

        // libx264: CRF 23, varying preset speed
        (EncoderType::Software, CodecFamily::H264, "libx264") => {
            let speed = match preset {
                QualityPreset::Fast => "ultrafast",
                QualityPreset::Medium => "medium",
                QualityPreset::High => "veryslow",
            };
            vec![
                "-c:v".into(), "libx264".into(),
                "-preset".into(), speed.into(),
                "-crf".into(), "23".into(),
                "-an".into(),
            ]
        }

        // libx265: CRF 28, varying preset speed
        (EncoderType::Software, CodecFamily::H265, "libx265") => {
            let speed = match preset {
                QualityPreset::Fast => "ultrafast",
                QualityPreset::Medium => "medium",
                QualityPreset::High => "veryslow",
            };
            vec![
                "-c:v".into(), "libx265".into(),
                "-preset".into(), speed.into(),
                "-crf".into(), "28".into(),
                "-an".into(),
            ]
        }

        // SVT-AV1: CRF 30, numeric presets (higher = faster)
        (EncoderType::Software, CodecFamily::AV1, "libsvtav1") => {
            let speed = match preset {
                QualityPreset::Fast => "10",
                QualityPreset::Medium => "6",
                QualityPreset::High => "2",
            };
            vec![
                "-c:v".into(), "libsvtav1".into(),
                "-preset".into(), speed.into(),
                "-crf".into(), "30".into(),
                "-an".into(),
            ]
        }

        // libaom-av1: CRF 30, cpu-used (higher = faster)
        (EncoderType::Software, CodecFamily::AV1, "libaom-av1") => {
            let speed = match preset {
                QualityPreset::Fast => "8",
                QualityPreset::Medium => "5",
                QualityPreset::High => "2",
            };
            vec![
                "-c:v".into(), "libaom-av1".into(),
                "-cpu-used".into(), speed.into(),
                "-crf".into(), "30".into(),
                "-an".into(),
            ]
        }

        // ProRes: profile-based (no CRF). Use .mov container.
        (EncoderType::Software, CodecFamily::ProRes, "prores_ks") => {
            let profile = match preset {
                QualityPreset::Fast => "0",   // Proxy
                QualityPreset::Medium => "2", // Normal
                QualityPreset::High => "3",   // HQ
            };
            vec![
                "-c:v".into(), "prores_ks".into(),
                "-profile:v".into(), profile.into(),
                "-an".into(),
            ]
        }

        // ── Hardware: VideoToolbox ─────────────────────────────────────

        (EncoderType::Hardware, CodecFamily::H264, "h264_videotoolbox") => {
            let q = match preset {
                QualityPreset::Fast => "65",
                QualityPreset::Medium => "50",
                QualityPreset::High => "35",
            };
            vec![
                "-c:v".into(), "h264_videotoolbox".into(),
                "-q:v".into(), q.into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::H265, "hevc_videotoolbox") => {
            let q = match preset {
                QualityPreset::Fast => "65",
                QualityPreset::Medium => "50",
                QualityPreset::High => "35",
            };
            vec![
                "-c:v".into(), "hevc_videotoolbox".into(),
                "-q:v".into(), q.into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::AV1, "av1_videotoolbox") => {
            let q = match preset {
                QualityPreset::Fast => "65",
                QualityPreset::Medium => "50",
                QualityPreset::High => "35",
            };
            vec![
                "-c:v".into(), "av1_videotoolbox".into(),
                "-q:v".into(), q.into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::ProRes, "prores_videotoolbox") => {
            let profile = match preset {
                QualityPreset::Fast => "0",
                QualityPreset::Medium => "2",
                QualityPreset::High => "3",
            };
            vec![
                "-c:v".into(), "prores_videotoolbox".into(),
                "-profile:v".into(), profile.into(),
                "-an".into(),
            ]
        }

        // ── Hardware: NVENC ────────────────────────────────────────────

        (EncoderType::Hardware, CodecFamily::H264, "h264_nvenc") => {
            let nvpreset = match preset {
                QualityPreset::Fast => "p1",
                QualityPreset::Medium => "p4",
                QualityPreset::High => "p7",
            };
            vec![
                "-c:v".into(), "h264_nvenc".into(),
                "-preset".into(), nvpreset.into(),
                "-cq".into(), "23".into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::H265, "hevc_nvenc") => {
            let nvpreset = match preset {
                QualityPreset::Fast => "p1",
                QualityPreset::Medium => "p4",
                QualityPreset::High => "p7",
            };
            vec![
                "-c:v".into(), "hevc_nvenc".into(),
                "-preset".into(), nvpreset.into(),
                "-cq".into(), "28".into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::AV1, "av1_nvenc") => {
            let nvpreset = match preset {
                QualityPreset::Fast => "p1",
                QualityPreset::Medium => "p4",
                QualityPreset::High => "p7",
            };
            vec![
                "-c:v".into(), "av1_nvenc".into(),
                "-preset".into(), nvpreset.into(),
                "-cq".into(), "30".into(),
                "-an".into(),
            ]
        }

        // ── Hardware: Intel QSV ────────────────────────────────────────

        (EncoderType::Hardware, CodecFamily::H264, "h264_qsv") => {
            let qsv_preset = match preset {
                QualityPreset::Fast => "veryfast",
                QualityPreset::Medium => "medium",
                QualityPreset::High => "veryslow",
            };
            vec![
                "-c:v".into(), "h264_qsv".into(),
                "-preset".into(), qsv_preset.into(),
                "-global_quality".into(), "23".into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::H265, "hevc_qsv") => {
            let qsv_preset = match preset {
                QualityPreset::Fast => "veryfast",
                QualityPreset::Medium => "medium",
                QualityPreset::High => "veryslow",
            };
            vec![
                "-c:v".into(), "hevc_qsv".into(),
                "-preset".into(), qsv_preset.into(),
                "-global_quality".into(), "28".into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::AV1, "av1_qsv") => {
            let qsv_preset = match preset {
                QualityPreset::Fast => "veryfast",
                QualityPreset::Medium => "medium",
                QualityPreset::High => "veryslow",
            };
            vec![
                "-c:v".into(), "av1_qsv".into(),
                "-preset".into(), qsv_preset.into(),
                "-global_quality".into(), "30".into(),
                "-an".into(),
            ]
        }

        // ── Hardware: AMD AMF ──────────────────────────────────────────

        (EncoderType::Hardware, CodecFamily::H264, "h264_amf") => {
            let quality = match preset {
                QualityPreset::Fast => "speed",
                QualityPreset::Medium => "balanced",
                QualityPreset::High => "quality",
            };
            vec![
                "-c:v".into(), "h264_amf".into(),
                "-quality".into(), quality.into(),
                "-rc".into(), "cqp".into(),
                "-qp_i".into(), "23".into(),
                "-qp_p".into(), "23".into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::H265, "hevc_amf") => {
            let quality = match preset {
                QualityPreset::Fast => "speed",
                QualityPreset::Medium => "balanced",
                QualityPreset::High => "quality",
            };
            vec![
                "-c:v".into(), "hevc_amf".into(),
                "-quality".into(), quality.into(),
                "-rc".into(), "cqp".into(),
                "-qp_i".into(), "28".into(),
                "-qp_p".into(), "28".into(),
                "-an".into(),
            ]
        }

        (EncoderType::Hardware, CodecFamily::AV1, "av1_amf") => {
            let quality = match preset {
                QualityPreset::Fast => "speed",
                QualityPreset::Medium => "balanced",
                QualityPreset::High => "quality",
            };
            vec![
                "-c:v".into(), "av1_amf".into(),
                "-quality".into(), quality.into(),
                "-rc".into(), "cqp".into(),
                "-qp_i".into(), "30".into(),
                "-qp_p".into(), "30".into(),
                "-an".into(),
            ]
        }

        // Fallback for any unmatched encoder
        _ => {
            vec![
                "-c:v".into(), encoder.name.clone(),
                "-an".into(),
            ]
        }
    }
}

/// Determine the output file extension for a given codec family.
/// Use mp4 for H.264/H.265/AV1 (required for AV1 on macOS WebView; broad support).
/// Use mov for ProRes (natural Apple container).
pub fn output_extension(codec_family: &CodecFamily) -> &'static str {
    match codec_family {
        CodecFamily::ProRes => "mov",
        _ => "mp4",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_libx264_fast() {
        let enc = EncoderDef {
            name: "libx264".into(),
            codec_family: CodecFamily::H264,
            encoder_type: EncoderType::Software,
            display_name: "H.264 (x264)".into(),
        };
        let args = build_encode_args(&enc, &QualityPreset::Fast);
        assert!(args.contains(&"ultrafast".to_string()));
        assert!(args.contains(&"23".to_string()));
    }

    #[test]
    fn test_libsvtav1_high() {
        let enc = EncoderDef {
            name: "libsvtav1".into(),
            codec_family: CodecFamily::AV1,
            encoder_type: EncoderType::Software,
            display_name: "AV1 (SVT-AV1)".into(),
        };
        let args = build_encode_args(&enc, &QualityPreset::High);
        assert!(args.contains(&"2".to_string())); // preset 2
        assert!(args.contains(&"30".to_string())); // crf 30
    }

    #[test]
    fn test_prores_profiles() {
        let enc = EncoderDef {
            name: "prores_ks".into(),
            codec_family: CodecFamily::ProRes,
            encoder_type: EncoderType::Software,
            display_name: "ProRes".into(),
        };
        let fast = build_encode_args(&enc, &QualityPreset::Fast);
        let high = build_encode_args(&enc, &QualityPreset::High);
        assert!(fast.contains(&"0".to_string()));  // Proxy
        assert!(high.contains(&"3".to_string()));  // HQ
    }

    #[test]
    fn test_prores_uses_mov_extension() {
        assert_eq!(output_extension(&CodecFamily::ProRes), "mov");
        assert_eq!(output_extension(&CodecFamily::H264), "mp4");
        assert_eq!(output_extension(&CodecFamily::AV1), "mp4");
    }
}
