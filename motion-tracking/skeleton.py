"""
Real-time Human Pose Detection and Floor Position Mapping

This module captures video from a camera or file, detects human poses using YOLOv8,
and maps the detected person's floor position to real-world coordinates using 
homography transformation. It sends position data via OSC for integration with
interactive systems.

Usage examples:
    # Live camera feed (camera index 2)
    python3 skeleton.py --cam 2 --model yolov8s-pose.pt
    
    # Video file input
    python3 skeleton.py --video path/to/video.mp4 --model yolov8s-pose.pt

Requirements:
    - floor_homography.npy: Pre-computed homography matrix for pixel-to-floor mapping
    - YOLOv8 pose model file (e.g., yolov8s-pose.pt)
"""

import argparse
import cv2
import numpy as np
from ultralytics import YOLO
from typing import Optional, Tuple, List, NamedTuple, Protocol
from pythonosc.udp_client import SimpleUDPClient
from dataclasses import dataclass
from abc import ABC, abstractmethod
import time
import math
from collections import defaultdict

# ================================
# POSE MODEL CONFIGURATION
# ================================

# COCO keypoint indices and names for YOLOv8 pose estimation (17 keypoints total)
# These correspond to the standard COCO pose keypoint format
COCO_KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", 
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

# Keypoint indices for easier reference
class KeypointIndices:
    """Semantic mapping of body part names to their COCO keypoint indices"""
    NOSE = 0
    LEFT_EYE = 1
    RIGHT_EYE = 2
    LEFT_EAR = 3
    RIGHT_EAR = 4
    LEFT_SHOULDER = 5
    RIGHT_SHOULDER = 6
    LEFT_ELBOW = 7
    RIGHT_ELBOW = 8
    LEFT_WRIST = 9
    RIGHT_WRIST = 10
    LEFT_HIP = 11
    RIGHT_HIP = 12
    LEFT_KNEE = 13
    RIGHT_KNEE = 14
    LEFT_ANKLE = 15
    RIGHT_ANKLE = 16

# Skeleton connections for visualization - defines which keypoints to connect with lines
# Each tuple represents (start_keypoint_index, end_keypoint_index)
SKELETON_BONE_CONNECTIONS = [
    # Head connections
    (KeypointIndices.NOSE, KeypointIndices.LEFT_EYE),
    (KeypointIndices.NOSE, KeypointIndices.RIGHT_EYE),
    (KeypointIndices.LEFT_EYE, KeypointIndices.LEFT_EAR),
    (KeypointIndices.RIGHT_EYE, KeypointIndices.RIGHT_EAR),
    
    # Arm connections
    (KeypointIndices.LEFT_SHOULDER, KeypointIndices.RIGHT_SHOULDER),
    (KeypointIndices.LEFT_SHOULDER, KeypointIndices.LEFT_ELBOW),
    (KeypointIndices.LEFT_ELBOW, KeypointIndices.LEFT_WRIST),
    (KeypointIndices.RIGHT_SHOULDER, KeypointIndices.RIGHT_ELBOW),
    (KeypointIndices.RIGHT_ELBOW, KeypointIndices.RIGHT_WRIST),
    
    # Torso connections
    (KeypointIndices.LEFT_SHOULDER, KeypointIndices.LEFT_HIP),
    (KeypointIndices.RIGHT_SHOULDER, KeypointIndices.RIGHT_HIP),
    (KeypointIndices.LEFT_HIP, KeypointIndices.RIGHT_HIP),
    
    # Leg connections
    (KeypointIndices.LEFT_HIP, KeypointIndices.LEFT_KNEE),
    (KeypointIndices.LEFT_KNEE, KeypointIndices.LEFT_ANKLE),
    (KeypointIndices.RIGHT_HIP, KeypointIndices.RIGHT_KNEE),
    (KeypointIndices.RIGHT_KNEE, KeypointIndices.RIGHT_ANKLE)
]

# ================================
# VISUALIZATION COLORS (BGR format for OpenCV)
# ================================
class Colors:
    """Color constants for visualization elements"""
    BOUNDING_BOX = (0, 255, 0)      # Green
    SKELETON_BONES = (0, 255, 255)   # Yellow
    KEYPOINTS = (255, 0, 0)          # Blue
    FLOOR_POSITION = (0, 0, 255)     # Red
    TEXT = (0, 0, 255)               # Red


# ================================
# DATA STRUCTURES
# ================================

@dataclass(frozen=True)
class FloorPosition:
    """Represents a person's floor position with coordinate transformation"""
    pixel_x: float
    pixel_y: float
    floor_x: float
    floor_y: float
    person_id: int
    confidence: float


@dataclass(frozen=True)
class SkeletonBone:
    """Represents a skeleton bone connection between two keypoints"""
    start_x: int
    start_y: int
    end_x: int
    end_y: int
    confidence: float


@dataclass(frozen=True)
class Keypoint:
    """Represents a single detected keypoint"""
    x: int
    y: int
    confidence: float
    keypoint_type: int


@dataclass(frozen=True)
class BoundingBox:
    """Represents a person's bounding box"""
    x1: int
    y1: int
    x2: int
    y2: int


@dataclass(frozen=True)
class PersonDetection:
    """Represents a complete person detection with all associated data"""
    person_id: int
    keypoints: Tuple[Keypoint, ...]
    skeleton_bones: Tuple[SkeletonBone, ...]
    bounding_box: Optional[BoundingBox]
    floor_position: Optional[FloorPosition]


@dataclass(frozen=True)
class FrameAnalysis:
    """Represents complete frame analysis results"""
    frame_number: int
    detected_people: Tuple[PersonDetection, ...]
    processing_time_ms: float


@dataclass
class TrackedPerson:
    """Mutable tracking state for a person across frames"""
    person_id: int
    last_floor_position: Optional[FloorPosition]
    frames_since_detection: int
    total_detections: int
    first_seen_frame: int
    last_seen_frame: int
    
    def update_detection(self, floor_position: Optional[FloorPosition], frame_number: int) -> None:
        """Update tracking info when person is detected in a frame"""
        self.last_floor_position = floor_position
        self.frames_since_detection = 0
        self.total_detections += 1
        self.last_seen_frame = frame_number
    
    def increment_missed_frames(self) -> None:
        """Increment counter when person is not detected in a frame"""
        self.frames_since_detection += 1


# ================================
# I/O PROTOCOLS
# ================================

class OutputHandler(Protocol):
    """Protocol for handling output operations"""
    
    def log_detection_info(self, frame_analysis: FrameAnalysis) -> None:
        """Log detection information to console or other output"""
        ...
    
    def send_positions_frame(self, frame_analysis: FrameAnalysis) -> None:
        """Send all positions for the current frame"""
        ...


class Visualizer(Protocol):
    """Protocol for handling visualization operations"""
    
    def create_visualization_frame(
        self, 
        original_frame: np.ndarray, 
        frame_analysis: FrameAnalysis
    ) -> np.ndarray:
        """Create visualization frame without modifying the original"""
        ...

def transform_pixel_to_floor_coordinates(
    pixel_x: float, 
    pixel_y: float, 
    homography_matrix: np.ndarray
) -> Tuple[float, float]:
    """
    Transform a pixel coordinate to real-world floor coordinates using homography.
    
    This function applies a perspective transformation (homography) to convert
    image pixel coordinates to real-world floor coordinates in meters.
    
    Args:
        pixel_x: X coordinate in the image (pixels)
        pixel_y: Y coordinate in the image (pixels)
        homography_matrix: 3x3 homography transformation matrix
        
    Returns:
        Tuple of (floor_x, floor_y) coordinates in meters
        
    Note:
        The homography matrix must be pre-computed using corresponding points
        between the image plane and the real-world floor plane.
    """
    # OpenCV requires points in specific format: [[[x, y]]] for perspectiveTransform
    pixel_point = np.array([[[pixel_x, pixel_y]]], dtype=np.float32)
    
    # Apply perspective transformation to get real-world coordinates
    floor_coordinates = cv2.perspectiveTransform(pixel_point, homography_matrix)[0, 0]
    
    return float(floor_coordinates[0]), float(floor_coordinates[1])


def create_keypoints_from_detection(
    person_keypoints: np.ndarray, 
    keypoint_confidence_threshold: float
) -> Tuple[Keypoint, ...]:
    """
    Create keypoint objects from raw detection data.
    
    Args:
        person_keypoints: Raw keypoint array (17, 3) from YOLO
        keypoint_confidence_threshold: Minimum confidence for valid keypoints
        
    Returns:
        Tuple of Keypoint objects
    """
    keypoints = []
    for keypoint_idx, (x, y, confidence) in enumerate(person_keypoints):
        if confidence > keypoint_confidence_threshold:
            keypoints.append(Keypoint(
                x=int(x),
                y=int(y),
                confidence=float(confidence),
                keypoint_type=keypoint_idx
            ))
    return tuple(keypoints)


def create_skeleton_bones_from_keypoints(
    person_keypoints: np.ndarray,
    keypoint_confidence_threshold: float
) -> Tuple[SkeletonBone, ...]:
    """
    Create skeleton bone objects from keypoint data.
    
    Args:
        person_keypoints: Raw keypoint array (17, 3) from YOLO
        keypoint_confidence_threshold: Minimum confidence for valid bones
        
    Returns:
        Tuple of SkeletonBone objects
    """
    bones = []
    for start_idx, end_idx in SKELETON_BONE_CONNECTIONS:
        start_point = person_keypoints[start_idx]
        end_point = person_keypoints[end_idx]
        
        if (start_point[2] > keypoint_confidence_threshold and 
            end_point[2] > keypoint_confidence_threshold):
            
            bones.append(SkeletonBone(
                start_x=int(start_point[0]),
                start_y=int(start_point[1]),
                end_x=int(end_point[0]),
                end_y=int(end_point[1]),
                confidence=min(float(start_point[2]), float(end_point[2]))
            ))
    return tuple(bones)


def create_floor_position_from_keypoints(
    person_keypoints: np.ndarray,
    person_id: int,
    keypoint_confidence_threshold: float,
    homography_matrix: np.ndarray
) -> Optional[FloorPosition]:
    """
    Create floor position from keypoint data.
    
    Args:
        person_keypoints: Raw keypoint array for one person
        person_id: Unique identifier for this person
        keypoint_confidence_threshold: Minimum confidence threshold
        homography_matrix: Homography matrix for coordinate transformation
        
    Returns:
        FloorPosition object or None if no reliable position found
    """
    pixel_x, pixel_y = determine_person_floor_position(
        person_keypoints, keypoint_confidence_threshold
    )
    
    if pixel_x is not None and pixel_y is not None:
        floor_x, floor_y = transform_pixel_to_floor_coordinates(
            pixel_x, pixel_y, homography_matrix
        )
        
        # Calculate confidence as average of ankle confidences
        left_ankle = person_keypoints[KeypointIndices.LEFT_ANKLE]
        right_ankle = person_keypoints[KeypointIndices.RIGHT_ANKLE]
        
        confidence = max(left_ankle[2], right_ankle[2])
        if left_ankle[2] > keypoint_confidence_threshold and right_ankle[2] > keypoint_confidence_threshold:
            confidence = (left_ankle[2] + right_ankle[2]) / 2.0
        
        return FloorPosition(
            pixel_x=float(pixel_x),
            pixel_y=float(pixel_y),
            floor_x=float(floor_x),
            floor_y=float(floor_y),
            person_id=person_id,
            confidence=float(confidence)
        )
    
    return None


# ================================
# I/O IMPLEMENTATIONS
# ================================

class ConsoleOutputHandler:
    """Handles console output for detection results"""
    
    def __init__(self, show_tracking_info: bool = False):
        self.show_tracking_info = show_tracking_info
    
    def log_detection_info(self, frame_analysis: FrameAnalysis) -> None:
        """Log detection information to console"""
        print(f"\n--- Frame {frame_analysis.frame_number}: {len(frame_analysis.detected_people)} person(s) detected ---")
        print(f"Processing time: {frame_analysis.processing_time_ms:.1f}ms")
        
        for person in frame_analysis.detected_people:
            print(f"\nPerson ID {person.person_id}:")
            if person.floor_position:
                fp = person.floor_position
                print(f"  FLOOR POSITION (meters): X={fp.floor_x:.2f}, Y={fp.floor_y:.2f} (confidence: {fp.confidence:.2f})")
            else:
                print("  FLOOR POSITION: No ankle keypoints detected with sufficient confidence")
    
    def send_positions_frame(self, frame_analysis: FrameAnalysis) -> None:
        """Console handler doesn't send position frames"""
        pass


class OSCOutputHandler:
    """Handles OSC communication for position data"""
    
    def __init__(self, osc_host: str = "127.0.0.1", osc_port: int = 9000):
        self.osc_client = SimpleUDPClient(osc_host, osc_port)
        self.last_positions: dict[int, Tuple[float, float]] = {}
    
    def log_detection_info(self, frame_analysis: FrameAnalysis) -> None:
        """OSC handler doesn't log to console"""
        pass
    
    def send_positions_frame(self, frame_analysis: FrameAnalysis) -> None:
        """Send all current positions if there are changes from last frame"""
        current_positions = {}
        
        # Extract current positions
        for person in frame_analysis.detected_people:
            if person.floor_position:
                current_positions[person.person_id] = (
                    person.floor_position.floor_x,
                    person.floor_position.floor_y
                )
        
        # Check if positions have changed
        if current_positions != self.last_positions:
            # Send OSC message with all current positions
            message_data = []
            for person_id, (x, y) in current_positions.items():
                message_data.extend([person_id, x, y])
            
            self.osc_client.send_message("/people/positions", message_data)
            self.last_positions = current_positions.copy()


class CombinedOutputHandler:
    """Combines multiple output handlers for comprehensive I/O"""
    
    def __init__(self, handlers: List[OutputHandler]):
        self.handlers = handlers
    
    def log_detection_info(self, frame_analysis: FrameAnalysis) -> None:
        for handler in self.handlers:
            handler.log_detection_info(frame_analysis)
    
    def send_positions_frame(self, frame_analysis: FrameAnalysis) -> None:
        for handler in self.handlers:
            handler.send_positions_frame(frame_analysis)


class OpenCVVisualizer:
    """Handles OpenCV-based visualization rendering"""
    
    def create_visualization_frame(
        self, 
        original_frame: np.ndarray, 
        frame_analysis: FrameAnalysis
    ) -> np.ndarray:
        """Create visualization frame without modifying the original"""
        # Create a copy for visualization
        visualization_frame = original_frame.copy()
        
        # Draw all detected people
        for person in frame_analysis.detected_people:
            self._draw_person_on_frame(visualization_frame, person)
        
        return visualization_frame
    
    def _draw_person_on_frame(
        self, 
        visualization_frame: np.ndarray, 
        person: PersonDetection
    ) -> None:
        """Draw a single person's skeleton and information on the frame"""
        frame_height, frame_width = visualization_frame.shape[:2]
        
        # Calculate ID text position (top of bounding box or top of keypoints)
        id_x, id_y = self._calculate_id_position(person, frame_width, frame_height)
        
        # Draw person ID with background for visibility
        id_text = f"ID {person.person_id}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.8
        thickness = 2
        
        # Get text size for background rectangle
        (text_width, text_height), baseline = cv2.getTextSize(id_text, font, font_scale, thickness)
        
        # Draw background rectangle for text
        bg_x1 = max(0, id_x - 5)
        bg_y1 = max(0, id_y - text_height - 10)
        bg_x2 = min(frame_width, id_x + text_width + 5)
        bg_y2 = id_y + 5
        
        cv2.rectangle(visualization_frame, (bg_x1, bg_y1), (bg_x2, bg_y2), (0, 0, 0), -1)
        
        # Draw ID text
        cv2.putText(
            visualization_frame, 
            id_text, 
            (id_x, id_y), 
            font, 
            font_scale, 
            (255, 255, 255),  # White text
            thickness
        )
        
        # Draw bounding box if available
        if person.bounding_box:
            bbox = person.bounding_box
            cv2.rectangle(
                visualization_frame,
                (bbox.x1, bbox.y1),
                (bbox.x2, bbox.y2),
                Colors.BOUNDING_BOX,
                2
            )
        
        # Draw skeleton bones
        for bone in person.skeleton_bones:
            cv2.line(
                visualization_frame,
                (bone.start_x, bone.start_y),
                (bone.end_x, bone.end_y),
                Colors.SKELETON_BONES,
                2
            )
        
        # Draw keypoints
        for keypoint in person.keypoints:
            cv2.circle(
                visualization_frame,
                (keypoint.x, keypoint.y),
                4,
                Colors.KEYPOINTS,
                -1
            )
        
        # Draw floor position indicator
        if person.floor_position:
            fp = person.floor_position
            cv2.circle(
                visualization_frame,
                (int(fp.pixel_x), int(fp.pixel_y)),
                8,
                Colors.FLOOR_POSITION,
                -1
            )
            
            # Add text label with coordinates
            position_text = f"{fp.floor_x:.2f},{fp.floor_y:.2f}m"
            cv2.putText(
                visualization_frame,
                position_text,
                (int(fp.pixel_x) + 10, int(fp.pixel_y)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                Colors.TEXT,
                2
            )

    def _calculate_id_position(
        self, 
        person: PersonDetection, 
        frame_width: int, 
        frame_height: int
    ) -> Tuple[int, int]:
        """Calculate the best position for drawing person ID, ensuring it's always in frame"""
        
        # Priority 1: Use bounding box top-left if available
        if person.bounding_box:
            id_x = max(10, min(frame_width - 100, person.bounding_box.x1))
            id_y = max(30, person.bounding_box.y1 + 20)
            return id_x, id_y
        
        # Priority 2: Use highest keypoint if available
        if person.keypoints:
            min_y = min(kp.y for kp in person.keypoints)
            avg_x = sum(kp.x for kp in person.keypoints) / len(person.keypoints)
            
            id_x = max(10, min(frame_width - 100, int(avg_x)))
            id_y = max(30, min_y - 10)
            return id_x, id_y
        
        # Priority 3: Use floor position if available
        if person.floor_position:
            id_x = max(10, min(frame_width - 100, int(person.floor_position.pixel_x)))
            id_y = max(30, int(person.floor_position.pixel_y) - 50)
            return id_x, id_y
        
        # Fallback: Use person ID to distribute across top of frame
        id_x = (person.person_id * 120) % (frame_width - 100) + 10
        id_y = 30
        return id_x, id_y


class GridVisualizer:
    """Visualizes floor positions on a 2D grid"""
    
    def __init__(
        self,
        grid_size: int = 400,
        grid_range: float = 6.0,
        margin: int = 50
    ):
        """
        Initialize grid visualizer.
        
        Args:
            grid_size: Size of the grid display in pixels
            grid_range: Maximum coordinate value in meters (0 to grid_range)
            margin: Margin around the grid in pixels
        """
        self.grid_size = grid_size
        self.grid_range = grid_range
        self.margin = margin
        self.total_size = grid_size + 2 * margin
        
    def create_grid_frame(self, frame_analysis: FrameAnalysis) -> np.ndarray:
        """Create a 2D grid visualization showing floor positions"""
        # Create white background
        grid_frame = np.ones((self.total_size, self.total_size, 3), dtype=np.uint8) * 255
        
        # Draw grid lines and labels
        self._draw_grid_lines(grid_frame)
        self._draw_axis_labels(grid_frame)
        
        # Draw person positions
        for person in frame_analysis.detected_people:
            if person.floor_position:
                self._draw_person_on_grid(grid_frame, person)
        
        return grid_frame
    
    def _draw_grid_lines(self, grid_frame: np.ndarray) -> None:
        """Draw grid lines and border"""
        # Draw border
        cv2.rectangle(
            grid_frame,
            (self.margin, self.margin),
            (self.margin + self.grid_size, self.margin + self.grid_size),
            (0, 0, 0),
            2
        )
        
        # Draw grid lines every 0.5 meters
        step = 0.5
        num_lines = int(self.grid_range / step)
        for i in range(1, num_lines):
            # Calculate pixel position
            pos = self.margin + int((i * step / self.grid_range) * self.grid_size)
            
            # Vertical lines
            cv2.line(
                grid_frame,
                (pos, self.margin),
                (pos, self.margin + self.grid_size),
                (200, 200, 200),
                1
            )
            
            # Horizontal lines
            cv2.line(
                grid_frame,
                (self.margin, pos),
                (self.margin + self.grid_size, pos),
                (200, 200, 200),
                1
            )
    
    def _draw_axis_labels(self, grid_frame: np.ndarray) -> None:
        """Draw axis labels and title"""
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.4
        thickness = 1
        
        # Title
        cv2.putText(
            grid_frame,
            "Floor Position (meters)",
            (self.margin, 20),
            font,
            0.6,
            (0, 0, 0),
            2
        )
        
        # X-axis labels - every 0.5 meters
        step = 0.5
        num_labels = int(self.grid_range / step) + 1
        for i in range(num_labels):
            value = i * step
            x_pos = self.margin + int((value / self.grid_range) * self.grid_size)
            label = f"{value:.1f}" if value % 1 != 0 else f"{int(value)}"
            cv2.putText(
                grid_frame,
                label,
                (x_pos - 10, self.total_size - self.margin + 20),
                font,
                font_scale,
                (0, 0, 0),
                thickness
            )
        
        # Y-axis labels (inverted because image Y grows downward) - every 0.5 meters
        for i in range(num_labels):
            value = i * step
            y_pos = self.margin + int((value / self.grid_range) * self.grid_size)
            label_value = self.grid_range - value
            label = f"{label_value:.1f}" if label_value % 1 != 0 else f"{int(label_value)}"
            cv2.putText(
                grid_frame,
                label,
                (10, y_pos + 5),
                font,
                font_scale,
                (0, 0, 0),
                thickness
            )
        
        # Axis names
        cv2.putText(grid_frame, "X", (self.total_size - 30, self.total_size - 10), 
                   font, 0.5, (0, 0, 0), thickness)
        cv2.putText(grid_frame, "Y", (10, 40), 
                   font, 0.5, (0, 0, 0), thickness)
    
    def _draw_person_on_grid(self, grid_frame: np.ndarray, person: PersonDetection) -> None:
        """Draw a person's position on the grid"""
        fp = person.floor_position
        
        # Clamp coordinates to grid range
        x = max(0, min(self.grid_range, fp.floor_x))
        y = max(0, min(self.grid_range, fp.floor_y))
        
        # Convert floor coordinates to pixel coordinates
        # Y is inverted because image Y grows downward
        pixel_x = self.margin + int((x / self.grid_range) * self.grid_size)
        pixel_y = self.margin + int(((self.grid_range - y) / self.grid_range) * self.grid_size)
        
        # Draw person circle
        color = self._get_person_color(person.person_id)
        cv2.circle(grid_frame, (pixel_x, pixel_y), 8, color, -1)
        cv2.circle(grid_frame, (pixel_x, pixel_y), 8, (0, 0, 0), 1)
        
        # Draw person ID
        cv2.putText(
            grid_frame,
            f"ID{person.person_id}",
            (pixel_x + 12, pixel_y + 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (0, 0, 0),
            1
        )
        
        # Draw coordinates
        coord_text = f"({fp.floor_x:.1f}, {fp.floor_y:.1f})"
        cv2.putText(
            grid_frame,
            coord_text,
            (pixel_x + 12, pixel_y + 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.3,
            (100, 100, 100),
            1
        )
    
    def _get_person_color(self, person_id: int) -> Tuple[int, int, int]:
        """Get a consistent color for each person ID"""
        colors = [
            (255, 100, 100),  # Light blue
            (100, 255, 100),  # Light green
            (100, 100, 255),  # Light red
            (255, 255, 100),  # Light cyan
            (255, 100, 255),  # Light magenta
            (100, 255, 255),  # Light yellow
        ]
        return colors[person_id % len(colors)]


class PersonTracker:
    """
    Manages stable person IDs across frames using floor position tracking.
    
    This class maintains a registry of people and matches new detections to
    existing tracked people based on floor position proximity, ensuring
    stable IDs for tracking applications.
    """
    
    def __init__(
        self,
        max_distance_threshold: float = 2.0,  # meters
        max_frames_missing: int = 30,  # frames before considering person "lost"
        min_detections_for_stability: int = 3  # minimum detections before ID is considered stable
    ):
        """
        Initialize person tracker with configurable parameters.
        
        Args:
            max_distance_threshold: Maximum distance (meters) to consider a match
            max_frames_missing: Frames without detection before removing a person
            min_detections_for_stability: Minimum detections for a stable track
        """
        self.max_distance_threshold = max_distance_threshold
        self.max_frames_missing = max_frames_missing
        self.min_detections_for_stability = min_detections_for_stability
        
        self.tracked_people: dict[int, TrackedPerson] = {}
        self.next_person_id = 0
        self.current_frame = 0
    
    def update_frame(self, detected_people: List[PersonDetection], frame_number: int) -> Tuple[List[PersonDetection], List[int]]:
        """
        Update tracking for a new frame and return people with stable IDs.
        
        Args:
            detected_people: List of detections from current frame
            frame_number: Current frame number
            
        Returns:
            Tuple of:
            - List of PersonDetection objects with stable person_ids
            - List of person IDs that left the frame
        """
        self.current_frame = frame_number
        
        # Extract detections with floor positions for tracking
        detections_with_positions = [
            (i, person) for i, person in enumerate(detected_people)
            if person.floor_position is not None
        ]
        
        # Match detections to existing tracked people
        matched_pairs, unmatched_detections, unmatched_tracked = self._match_detections_to_tracks(
            detections_with_positions
        )
        
        # Update existing tracks with matches
        updated_people = list(detected_people)  # Start with original detections
        
        for detection_idx, track_id in matched_pairs:
            original_person = detected_people[detection_idx]
            tracked_person = self.tracked_people[track_id]
            
            # Update tracking state
            tracked_person.update_detection(original_person.floor_position, frame_number)
            
            # Create new PersonDetection with stable ID
            updated_person = self._create_person_with_stable_id(
                original_person, track_id
            )
            updated_people[detection_idx] = updated_person
        
        # Create new tracks for unmatched detections
        for detection_idx in unmatched_detections:
            original_person = detected_people[detection_idx]
            new_track_id = self._create_new_track(original_person, frame_number)
            
            # Create PersonDetection with new stable ID
            updated_person = self._create_person_with_stable_id(
                original_person, new_track_id
            )
            updated_people[detection_idx] = updated_person
        
        # Update unmatched tracked people (increment missed frames)
        for track_id in unmatched_tracked:
            self.tracked_people[track_id].increment_missed_frames()
        
        # Remove lost tracks and get their IDs
        removed_person_ids = self._remove_lost_tracks()
        
        return updated_people, removed_person_ids
    
    def _match_detections_to_tracks(
        self, 
        detections_with_positions: List[Tuple[int, PersonDetection]]
    ) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        """
        Match current detections to existing tracks using floor position distance.
        
        Returns:
            - matched_pairs: List of (detection_index, track_id) pairs
            - unmatched_detections: List of detection indices without matches
            - unmatched_tracked: List of track IDs without matches
        """
        if not self.tracked_people or not detections_with_positions:
            unmatched_detections = [idx for idx, _ in detections_with_positions]
            unmatched_tracked = list(self.tracked_people.keys())
            return [], unmatched_detections, unmatched_tracked
        
        # Calculate distance matrix between detections and tracks
        distance_matrix = []
        track_ids = list(self.tracked_people.keys())
        
        for detection_idx, person in detections_with_positions:
            detection_distances = []
            for track_id in track_ids:
                tracked_person = self.tracked_people[track_id]
                if (tracked_person.last_floor_position and person.floor_position):
                    distance = self._calculate_floor_distance(
                        person.floor_position, tracked_person.last_floor_position
                    )
                    detection_distances.append(distance)
                else:
                    detection_distances.append(float('inf'))
            distance_matrix.append(detection_distances)
        
        # Simple greedy matching (could be improved with Hungarian algorithm)
        matched_pairs = []
        unmatched_detections = set(range(len(detections_with_positions)))
        unmatched_tracked = set(range(len(track_ids)))
        
        # Find best matches iteratively
        while unmatched_detections and unmatched_tracked:
            best_distance = float('inf')
            best_detection_idx = None
            best_track_idx = None
            
            for det_idx in unmatched_detections:
                for track_idx in unmatched_tracked:
                    distance = distance_matrix[det_idx][track_idx]
                    if distance < best_distance and distance <= self.max_distance_threshold:
                        best_distance = distance
                        best_detection_idx = det_idx
                        best_track_idx = track_idx
            
            if best_detection_idx is not None and best_track_idx is not None:
                # Record match using original detection index and track ID
                original_detection_idx = detections_with_positions[best_detection_idx][0]
                track_id = track_ids[best_track_idx]
                matched_pairs.append((original_detection_idx, track_id))
                
                unmatched_detections.remove(best_detection_idx)
                unmatched_tracked.remove(best_track_idx)
            else:
                break  # No more valid matches
        
        # Convert remaining unmatched indices back to original detection indices
        unmatched_detection_indices = [
            detections_with_positions[i][0] for i in unmatched_detections
        ]
        unmatched_track_ids = [track_ids[i] for i in unmatched_tracked]
        
        return matched_pairs, unmatched_detection_indices, unmatched_track_ids
    
    def _calculate_floor_distance(
        self, 
        pos1: FloorPosition, 
        pos2: FloorPosition
    ) -> float:
        """Calculate Euclidean distance between two floor positions in meters"""
        dx = pos1.floor_x - pos2.floor_x
        dy = pos1.floor_y - pos2.floor_y
        return math.sqrt(dx * dx + dy * dy)
    
    def _create_new_track(self, person: PersonDetection, frame_number: int) -> int:
        """Create a new track for an unmatched detection"""
        new_id = self.next_person_id
        self.next_person_id += 1
        
        self.tracked_people[new_id] = TrackedPerson(
            person_id=new_id,
            last_floor_position=person.floor_position,
            frames_since_detection=0,
            total_detections=1,
            first_seen_frame=frame_number,
            last_seen_frame=frame_number
        )
        
        return new_id
    
    def _create_person_with_stable_id(
        self, 
        original_person: PersonDetection, 
        stable_id: int
    ) -> PersonDetection:
        """Create a new PersonDetection with stable ID, preserving all other data"""
        return PersonDetection(
            person_id=stable_id,
            keypoints=original_person.keypoints,
            skeleton_bones=original_person.skeleton_bones,
            bounding_box=original_person.bounding_box,
            floor_position=original_person.floor_position
        )
    
    def _remove_lost_tracks(self) -> List[int]:
        """Remove tracks that haven't been detected for too many frames"""
        tracks_to_remove = [
            track_id for track_id, tracked_person in self.tracked_people.items()
            if tracked_person.frames_since_detection > self.max_frames_missing
        ]
        
        for track_id in tracks_to_remove:
            del self.tracked_people[track_id]
        
        return tracks_to_remove
    
    def get_active_tracks_info(self) -> dict[int, dict]:
        """Get information about currently active tracks for debugging"""
        return {
            track_id: {
                'frames_since_detection': tracked.frames_since_detection,
                'total_detections': tracked.total_detections,
                'first_seen': tracked.first_seen_frame,
                'last_seen': tracked.last_seen_frame,
                'stable': tracked.total_detections >= self.min_detections_for_stability
            }
            for track_id, tracked in self.tracked_people.items()
        }


def determine_person_floor_position(
    detected_keypoints: np.ndarray,
    minimum_keypoint_confidence: float
) -> Tuple[Optional[float], Optional[float]]:
    """
    Determine the best pixel position representing a person's location on the floor.
    
    This function analyzes ankle keypoints to estimate where the person is standing.
    It prioritizes the midpoint between both ankles when both are confidently detected,
    and falls back to individual ankles when only one is reliable.
    
    Args:
        detected_keypoints: Array of shape (17, 3) containing [x, y, confidence] 
                           for each of the 17 COCO keypoints
        minimum_keypoint_confidence: Threshold for considering a keypoint reliable
        
    Returns:
        Tuple of (pixel_x, pixel_y) coordinates, or (None, None) if no reliable
        ankle positions are found
        
    Note:
        Ankle positions are preferred over other keypoints because they represent
        the person's contact with the ground plane most accurately.
    """
    left_ankle = detected_keypoints[KeypointIndices.LEFT_ANKLE]
    right_ankle = detected_keypoints[KeypointIndices.RIGHT_ANKLE]

    # Check if both ankles are confidently detected
    left_ankle_reliable = left_ankle[2] > minimum_keypoint_confidence
    right_ankle_reliable = right_ankle[2] > minimum_keypoint_confidence

    if left_ankle_reliable and right_ankle_reliable:
        # Use midpoint between both ankles for most accurate floor position
        midpoint_x = (left_ankle[0] + right_ankle[0]) / 2.0
        midpoint_y = (left_ankle[1] + right_ankle[1]) / 2.0
        return float(midpoint_x), float(midpoint_y)

    # Fall back to individual ankles if only one is reliable
    if left_ankle_reliable:
        return float(left_ankle[0]), float(left_ankle[1])

    if right_ankle_reliable:
        return float(right_ankle[0]), float(right_ankle[1])

    # Return None if no ankles are confidently detected
    return None, None


class SkeletonTracker:
    """
    Main class for real-time skeleton tracking and floor position mapping.
    
    This class handles pose detection and coordinate transformation with
    stable person ID tracking across frames.
    """
    
    def __init__(
        self,
        pose_model_path: str,
        homography_file_path: str,
        tracking_distance_threshold: float = 2.0,
        tracking_max_frames_missing: int = 30
    ):
        """
        Initialize the skeleton tracker with required models and tracking parameters.
        
        Args:
            pose_model_path: Path to YOLOv8 pose detection model file
            homography_file_path: Path to pre-computed homography matrix (.npy file)
            tracking_distance_threshold: Max distance (meters) for person matching
            tracking_max_frames_missing: Frames before considering person lost
        """
        self.pose_model = YOLO(pose_model_path)
        
        try:
            self.floor_homography_matrix = np.load(homography_file_path)
        except Exception as error:
            raise RuntimeError(
                f"Failed to load homography matrix from '{homography_file_path}': {error}"
            )
        
        self._frame_counter = 0
        self.person_tracker = PersonTracker(
            max_distance_threshold=tracking_distance_threshold,
            max_frames_missing=tracking_max_frames_missing
        )
        self._last_removed_person_ids: List[int] = []

    def get_last_removed_person_ids(self) -> List[int]:
        """Get person IDs that were removed in the last frame analysis"""
        return self._last_removed_person_ids

    def analyze_frame(
        self, 
        input_frame: np.ndarray, 
        detection_confidence: float,
        keypoint_confidence: float,
        inference_size: int
    ) -> FrameAnalysis:
        """
        Analyze a single frame and return detection results.
        
        Args:
            input_frame: Original camera/video frame
            detection_confidence: Minimum confidence for person detection
            keypoint_confidence: Minimum confidence for individual keypoints
            inference_size: Size for model inference
            
        Returns:
            FrameAnalysis object with all detection results
        """
        start_time = time.time()
        self._frame_counter += 1

        # Run pose detection
        detection_results = self.pose_model.predict(
            source=input_frame,
            imgsz=inference_size,
            conf=detection_confidence,
            verbose=False
        )

        # Process detection results into structured data
        detected_people = []
        primary_result = detection_results[0]

        if primary_result.keypoints is not None and len(primary_result.keypoints) > 0:
            all_keypoints = primary_result.keypoints.data.cpu().numpy()
            bounding_boxes = (primary_result.boxes.xyxy.cpu().numpy() 
                            if primary_result.boxes is not None else None)

            # Process each detected person with temporary indices first
            for person_index, person_keypoints in enumerate(all_keypoints):
                person_detection = self._create_person_detection(
                    person_keypoints, 
                    person_index,  # Temporary index, will be replaced by tracker
                    keypoint_confidence,
                    bounding_boxes[person_index] if bounding_boxes is not None else None
                )
                detected_people.append(person_detection)

        # Apply person tracking to assign stable IDs
        detected_people_with_stable_ids, removed_person_ids = self.person_tracker.update_frame(
            detected_people, self._frame_counter
        )
        
        # Store removed person IDs for later use
        self._last_removed_person_ids = removed_person_ids

        processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        return FrameAnalysis(
            frame_number=self._frame_counter,
            detected_people=tuple(detected_people_with_stable_ids),
            processing_time_ms=processing_time
        )
    
    def _create_person_detection(
        self,
        person_keypoints: np.ndarray,
        person_index: int,
        keypoint_confidence: float,
        bounding_box_data: Optional[np.ndarray]
    ) -> PersonDetection:
        """Create PersonDetection from raw detection data"""
        # Create keypoints
        keypoints = create_keypoints_from_detection(
            person_keypoints, keypoint_confidence
        )
        
        # Create skeleton bones
        skeleton_bones = create_skeleton_bones_from_keypoints(
            person_keypoints, keypoint_confidence
        )
        
        # Create bounding box if available
        bounding_box = None
        if bounding_box_data is not None:
            x1, y1, x2, y2 = bounding_box_data
            bounding_box = BoundingBox(
                x1=int(x1), y1=int(y1), x2=int(x2), y2=int(y2)
            )
        
        # Create floor position
        floor_position = create_floor_position_from_keypoints(
            person_keypoints, person_index, keypoint_confidence, self.floor_homography_matrix
        )
        
        return PersonDetection(
            person_id=person_index,
            keypoints=keypoints,
            skeleton_bones=skeleton_bones,
            bounding_box=bounding_box,
            floor_position=floor_position
        )


def create_argument_parser() -> argparse.ArgumentParser:
    """
    Create and configure command-line argument parser.
    
    Returns:
        Configured ArgumentParser instance with all required options
    """
    parser = argparse.ArgumentParser(
        description="Real-time human pose detection with floor position mapping",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # Input source options
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        "--cam", 
        type=int, 
        default=0, 
        help="Camera index for live video capture"
    )
    input_group.add_argument(
        "--video", 
        type=str, 
        help="Path to video file for processing"
    )
    
    # Model configuration
    parser.add_argument(
        "--model", 
        default="yolov8s-pose.pt", 
        help="Path to YOLOv8 pose detection model file"
    )
    parser.add_argument(
        "--conf", 
        type=float, 
        default=0.3, 
        help="Person detection confidence threshold (0.0-1.0)"
    )
    parser.add_argument(
        "--kpt_conf", 
        type=float, 
        default=0.5, 
        help="Individual keypoint confidence threshold (0.0-1.0)"
    )
    parser.add_argument(
        "--imgsz", 
        type=int, 
        default=960, 
        help="Model inference size in pixels (larger = more accurate but slower)"
    )
    
    # Coordinate transformation
    parser.add_argument(
        "--homography", 
        default="motion-tracking/floor_homography.npy", 
        help="Path to homography matrix file for pixel-to-floor coordinate transformation"
    )
    
    # Visualization options
    parser.add_argument(
        "--flip", 
        action="store_true", 
        help="Horizontally flip the camera view (useful for mirror-like display)"
    )
    
    # OSC communication
    parser.add_argument(
        "--osc_host", 
        type=str, 
        default="127.0.0.1", 
        help="OSC server hostname for sending position data"
    )
    parser.add_argument(
        "--osc_port", 
        type=int, 
        default=9000, 
        help="OSC server port for sending position data"
    )
    
    # Person tracking
    parser.add_argument(
        "--tracking_distance", 
        type=float, 
        default=2.0, 
        help="Maximum distance (meters) for matching people between frames"
    )
    parser.add_argument(
        "--tracking_timeout", 
        type=int, 
        default=30, 
        help="Frames without detection before considering person lost"
    )
    
    return parser

def main():
    """
    Main entry point for the skeleton tracking application.
    
    Handles argument parsing, video capture setup, and the main processing loop
    for real-time pose detection and floor position mapping.
    """
    # Parse command line arguments
    argument_parser = create_argument_parser()
    args = argument_parser.parse_args()

    # Initialize the skeleton tracker
    try:
        skeleton_tracker = SkeletonTracker(
            pose_model_path=args.model,
            homography_file_path=args.homography,
            tracking_distance_threshold=args.tracking_distance,
            tracking_max_frames_missing=args.tracking_timeout
        )
    except Exception as error:
        print(f"Failed to initialize skeleton tracker: {error}")
        return

    # Set up output handlers
    console_handler = ConsoleOutputHandler()
    osc_handler = OSCOutputHandler(args.osc_host, args.osc_port)
    output_handler = CombinedOutputHandler([console_handler, osc_handler])
    visualizer = OpenCVVisualizer()
    grid_visualizer = None  # Will be initialized with frame dimensions

    # Set up video capture source (camera or file)
    if args.video:
        video_capture = cv2.VideoCapture(args.video)
        print(f"Processing video file: {args.video}")
    elif args.cam is not None:
        video_capture = cv2.VideoCapture(args.cam)
        print(f"Using camera index: {args.cam}")
    else:
        argument_parser.error("Must specify either --cam or --video")

    # Verify that video source opened successfully
    if not video_capture.isOpened():
        if args.video:
            raise RuntimeError(f"Could not open video file: {args.video}")
        else:
            raise RuntimeError(f"Could not open camera index: {args.cam}")

    print("Skeleton tracking with floor mapping is running...")
    print("Press 'q' to quit, or close the window to stop.")

    try:
        # Main processing loop
        while True:
            # Capture frame from video source
            frame_captured_successfully, current_frame = video_capture.read()
            
            # Check if we've reached the end of a video file
            if not frame_captured_successfully:
                if args.video:
                    print("Reached end of video file.")
                else:
                    print("Failed to capture frame from camera.")
                break

            # Apply horizontal flip if requested (useful for mirror-like camera view)
            if args.flip:
                current_frame = cv2.flip(current_frame, 1)

            # Initialize grid visualizer with frame dimensions (first frame only)
            if grid_visualizer is None:
                frame_height = current_frame.shape[0]
                # Make grid square based on frame height, with reasonable margins
                grid_visualizer = GridVisualizer(
                    grid_size=frame_height - 100,
                    grid_range=3.0,  # Changed from 6.0 to 3.0 meters
                    margin=50
                )

            # Analyze the frame and get detection results
            frame_analysis = skeleton_tracker.analyze_frame(
                input_frame=current_frame,
                detection_confidence=args.conf,
                keypoint_confidence=args.kpt_conf,
                inference_size=args.imgsz
            )

            # Handle logging and communication
            output_handler.log_detection_info(frame_analysis)
            
            # Send all positions for this frame (only if changed)
            output_handler.send_positions_frame(frame_analysis)

            # Create and display visualization
            visualization_frame = visualizer.create_visualization_frame(
                current_frame, frame_analysis
            )
            
            # Create grid visualization
            grid_frame = grid_visualizer.create_grid_frame(frame_analysis)
            
            # Resize grid to match camera frame height if necessary
            if grid_frame.shape[0] != visualization_frame.shape[0]:
                grid_frame = cv2.resize(
                    grid_frame,
                    (grid_frame.shape[1], visualization_frame.shape[0]),
                    interpolation=cv2.INTER_LINEAR
                )
            
            # Combine visualizations side by side
            combined_frame = np.hstack([visualization_frame, grid_frame])
            
            cv2.imshow("Real-time Skeleton Tracking with Floor Position Mapping", combined_frame)
            
            # Check for quit command (press 'q' key)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("Quit command received.")
                break
                
    except KeyboardInterrupt:
        print("\nInterrupted by user (Ctrl+C)")
    except Exception as error:
        print(f"An error occurred during processing: {error}")
    finally:
        # Clean up resources
        video_capture.release()
        cv2.destroyAllWindows()
        print("Resources cleaned up. Application terminated.")


if __name__ == "__main__":
    main()
