-- checkedAt 은 이제 "영상 ID 를 마지막으로 찾아본 때"만 뜻한다.
-- 예전 수집은 영상을 찾지 않고도 checkedAt 을 찍었으니, 영상이 없는 곡은 비워 다시 물어볼 수 있게 한다
UPDATE "Track" SET "checkedAt" = NULL WHERE "videoId" IS NULL;
