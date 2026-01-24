# Use the videos from /data folder as virtual camera input for testing.
# Then run:
# python3 skeleton.py --cam 2 --model yolov8s-pose.pt
#
# DONE: Requires: floor_homography.npy
# DONE: Maps ankle pixel coords -> room floor coords (meters)


import argparse
import cv2
import numpy as np
from ultralytics import YOLO
from typing import Optional, Tuple
from pythonosc.udp_client import SimpleUDPClient

# COCO keypoint names for YOLOv8 pose (17 keypoints)
KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

SKELETON_CONNECTIONS = [
    (0, 1), (0, 2), (1, 3), (2, 4),  # Head
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # Arms
    (5, 11), (6, 12), (11, 12),  # Torso
    (11, 13), (13, 15), (12, 14), (14, 16)  # Legs
]

def pixel_to_floor(u: float, v: float, H_floor: np.ndarray) -> Tuple[float, float]:
    """Map a pixel coordinate (u,v) to floor (X,Y) in meters."""
    pt = np.array([[[u, v]]], dtype=np.float32)
    XY = cv2.perspectiveTransform(pt, H_floor)[0, 0]
    return float(XY[0]), float(XY[1])

def choose_foot_point(
    kpts: np.ndarray,
    kpt_conf: float
) -> Tuple[Optional[float], Optional[float]]:
    """
    Choose a single pixel point that best represents the person's position on the floor.
    Prefers midpoint of both ankles; falls back to whichever ankle is confident.
    """
    L = kpts[15]  # left_ankle
    R = kpts[16]  # right_ankle

    if L[2] > kpt_conf and R[2] > kpt_conf:
        u = (L[0] + R[0]) / 2.0
        v = (L[1] + R[1]) / 2.0
        return float(u), float(v)

    if L[2] > kpt_conf:
        return float(L[0]), float(L[1])

    if R[2] > kpt_conf:
        return float(R[0]), float(R[1])

    return None, None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cam", type=int, default=0, help="Camera index")
    ap.add_argument("--video", type=str, help="Path to video file")
    ap.add_argument("--model", default="yolov8s-pose.pt", help="YOLOv8 pose model")
    ap.add_argument("--conf", type=float, default=0.3, help="Detection confidence threshold")
    ap.add_argument("--imgsz", type=int, default=960, help="Inference size")
    ap.add_argument("--flip", action="store_true", help="Mirror view")
    ap.add_argument("--kpt_conf", type=float, default=0.5, help="Keypoint confidence threshold")
    ap.add_argument("--homography", default="motion-tracking/floor_homography.npy", help="Pixel→floor homography")

    ap.add_argument("--osc_host", type=str, default="127.0.0.1", help="OSC server host (Next.js)")
    ap.add_argument("--osc_port", type=int, default=9000, help="OSC server port (Next.js)")
    args = ap.parse_args()

    # Set up OSC client
    osc_client = SimpleUDPClient(args.osc_host, args.osc_port)

    model = YOLO(args.model)

    try:
        H_floor = np.load(args.homography)
    except Exception as e:
        raise RuntimeError(f"Could not load homography '{args.homography}': {e}")

    if args.video:
        cap = cv2.VideoCapture(args.video)
    elif args.cam is not None:
        cap = cv2.VideoCapture(args.cam)
    else:
        ap.error("Specify either --cam or --video")

    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera index {args.cam}")

    print("Running skeleton tracking + floor mapping. Press 'q' to quit.")

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if args.flip:
            frame = cv2.flip(frame, 1)

        vis = frame.copy()

        results = model.predict(
            source=frame,
            imgsz=args.imgsz,
            conf=args.conf,
            verbose=False
        )

        r0 = results[0]

        if r0.keypoints is not None and len(r0.keypoints) > 0:
            keypoints_data = r0.keypoints.data.cpu().numpy()
            boxes = r0.boxes.xyxy.cpu().numpy() if r0.boxes is not None else None

            print(f"\n--- Frame: {len(keypoints_data)} person(s) detected ---")

            for person_idx, kpts in enumerate(keypoints_data):
                print(f"\nPerson {person_idx + 1}:")

                if boxes is not None and person_idx < len(boxes):
                    x1, y1, x2, y2 = boxes[person_idx]
                    cv2.rectangle(vis, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)

                for start_idx, end_idx in SKELETON_CONNECTIONS:
                    if kpts[start_idx][2] > args.kpt_conf and kpts[end_idx][2] > args.kpt_conf:
                        pt1 = (int(kpts[start_idx][0]), int(kpts[start_idx][1]))
                        pt2 = (int(kpts[end_idx][0]), int(kpts[end_idx][1]))
                        cv2.line(vis, pt1, pt2, (0, 255, 255), 2)

                for kpt_idx, (x, y, conf) in enumerate(kpts):
                    if conf > args.kpt_conf:
                        cv2.circle(vis, (int(x), int(y)), 4, (255, 0, 0), -1)

                # --- FLOOR MAPPING ---
                u, v = choose_foot_point(kpts, args.kpt_conf)
                if u is not None:
                    X, Y = pixel_to_floor(u, v, H_floor)
                    print(f"  FLOOR (m): X={X:.2f}, Y={Y:.2f}")

                    # Send OSC message to Next.js server
                    # Example address: /people/position, args: person_idx, X, Y
                    osc_client.send_message("/people/position", [person_idx, X, Y])

                    cv2.circle(vis, (int(u), int(v)), 8, (0, 0, 255), -1)
                    cv2.putText(
                        vis, f"{X:.2f},{Y:.2f}m",
                        (int(u) + 10, int(v)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2
                    )
                else:
                    print("  FLOOR: no ankle confident enough")

        cv2.imshow("Skeleton + Floor Mapping", vis)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
