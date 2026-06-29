-- 개신동 아파트 3층
UPDATE properties
SET lat = 36.6256841283561, lng = 127.467473802519, updated_at = now()
WHERE id = '20f61bb3-1157-4998-b04c-b011a3aa61ee';

-- 복대동 투룸 2층
UPDATE properties
SET lat = 36.628891866364, lng = 127.444859484426, updated_at = now()
WHERE id = 'f892e9b0-4d84-41fa-b49f-b196a65e44e9';

-- 금천동 투베이 9층 (동 단위 좌표)
UPDATE properties
SET lat = 36.6244437109155, lng = 127.499262949215, updated_at = now()
WHERE id = '0d6de934-52d9-4d03-a780-2815f25cf38a';