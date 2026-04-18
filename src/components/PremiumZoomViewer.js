import React, { useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Animated, 
  PanResponder, 
  TouchableWithoutFeedback 
} from 'react-native';

const { width, height } = Dimensions.get('window');

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

export default function PremiumZoomViewer({ uri, onSingleTap, onDismiss, onZoomChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dismissY = useRef(new Animated.Value(0)).current;

  // Trackers
  const baseScale = useRef(1);
  const pinchDistance = useRef(null);
  const lastTapTime = useRef(0);
  const isZoomed = useRef(false);

  // Notify Parent (ScanScreen) to disable flatlist scrolling when zoomed
  const checkZoomState = (currentScale) => {
    const zoomed = currentScale > 1.05;
    if (zoomed !== isZoomed.current) {
      isZoomed.current = zoomed;
      if (onZoomChange) onZoomChange(zoomed);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches.length;
        if (touches === 2) return true; // Start pinching
        if (baseScale.current > 1.05) return true; // Start panning
        // Start swipe-to-dismiss only if pulling down vertically at 1x scale
        if (touches === 1 && gestureState.dy > 15 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
        dismissY.setOffset(dismissY._value);
        dismissY.setValue(0);
        pinchDistance.current = null;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        // PINCH TO ZOOM
        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (!pinchDistance.current) {
            pinchDistance.current = distance;
          } else {
            const scaleMultiplier = distance / pinchDistance.current;
            let newScale = baseScale.current * scaleMultiplier;
            // Soft clamp
            newScale = Math.max(0.8, Math.min(newScale, MAX_SCALE + 1));
            scale.setValue(newScale);
            checkZoomState(newScale);
          }
        } 
        // PAN OR DISMISS
        else if (touches.length === 1) {
          if (baseScale.current > 1.05) {
            // Panning when zoomed
            pan.setValue({ x: gestureState.dx, y: gestureState.dy });
          } else {
            // Swipe down to dismiss
            if (gestureState.dy > 0) {
              dismissY.setValue(gestureState.dy);
            }
          }
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        pan.flattenOffset();
        dismissY.flattenOffset();
        pinchDistance.current = null;

        // 1. Sync Base Scale
        let currentScale = scale._value;
        if (currentScale < MIN_SCALE) {
          currentScale = MIN_SCALE;
          Animated.spring(scale, { toValue: MIN_SCALE, friction: 7, useNativeDriver: true }).start();
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, useNativeDriver: true }).start();
        } else if (currentScale > MAX_SCALE) {
          currentScale = MAX_SCALE;
          Animated.spring(scale, { toValue: MAX_SCALE, friction: 7, useNativeDriver: true }).start();
        }
        baseScale.current = currentScale;
        checkZoomState(currentScale);

        // 2. Handle Image Lock (Clamp Pan Boundaries)
        if (currentScale > 1.05) {
          const boundX = Math.max(0, (width * currentScale - width) / 2);
          const boundY = Math.max(0, (height * currentScale - height) / 2);

          let nextX = pan.x._value;
          let nextY = pan.y._value;

          if (nextX > boundX) nextX = boundX;
          if (nextX < -boundX) nextX = -boundX;
          if (nextY > boundY) nextY = boundY;
          if (nextY < -boundY) nextY = -boundY;

          Animated.spring(pan, {
            toValue: { x: nextX, y: nextY },
            friction: 7,
            useNativeDriver: true,
          }).start();
        }

        // 3. Handle Swipe Down Dismiss
        if (currentScale <= 1.05) {
          if (dismissY._value > 120 || gestureState.vy > 1.5) {
            // Threshold crossed -> Close
            Animated.timing(dismissY, { toValue: height, duration: 250, useNativeDriver: true }).start(() => {
              if (onDismiss) onDismiss();
            });
          } else {
            // Spring back to center
            Animated.spring(dismissY, { toValue: 0, friction: 6, useNativeDriver: true }).start();
          }
        }
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        dismissY.flattenOffset();
        pinchDistance.current = null;
      }
    })
  ).current;

  // SMART TAP SYSTEM (Double & Single)
  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapTime.current < DOUBLE_PRESS_DELAY) {
      // It's a Double Tap!
      lastTapTime.current = 0;
      if (baseScale.current > 1.05) {
        // Zoom Out
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: 200, useNativeDriver: true })
        ]).start(() => {
          baseScale.current = 1;
          checkZoomState(1);
        });
      } else {
        // Zoom In
        Animated.timing(scale, { toValue: DOUBLE_TAP_SCALE, duration: 200, useNativeDriver: true }).start(() => {
          baseScale.current = DOUBLE_TAP_SCALE;
          checkZoomState(DOUBLE_TAP_SCALE);
        });
      }
    } else {
      // It's a Single Tap (Wait to see if a second tap comes)
      lastTapTime.current = now;
      setTimeout(() => {
        if (lastTapTime.current === now) {
          if (onSingleTap) onSingleTap();
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const animatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: Animated.add(pan.y, dismissY) },
      { scale: scale },
    ],
  };

  const bgOpacity = dismissY.interpolate({
    inputRange: [0, height / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: bgOpacity }]} />
      <TouchableWithoutFeedback onPress={handleTap}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          <Animated.Image 
            source={{ uri }} 
            style={styles.image} 
            resizeMode="contain" 
          />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
