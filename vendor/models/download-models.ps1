# 전시 PC를 인터넷 없이 돌리기 위해 손·자세 인식 모델을 이 폴더에 내려받는다.
# 사용: PowerShell에서 이 폴더로 이동한 뒤  .\download-models.ps1
$base = "https://storage.googleapis.com/mediapipe-models"
Invoke-WebRequest "$base/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" -OutFile "$PSScriptRoot\pose_landmarker_lite.task"
Invoke-WebRequest "$base/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -OutFile "$PSScriptRoot\hand_landmarker.task"
Write-Host "완료: pose_landmarker_lite.task, hand_landmarker.task"
