# 페르소나 전략 — 그로스 마케터 (로컬 서비스 리드젠)

## 진단

- 리드 마그넷("무료 즉시 견적")이 auth 벽 뒤에 갇힘. lite 폼은 dark code (연락처 필드도 없음).
- 후속 조치 0: Twilio/Resend 등 발송 인프라 전무. timingPurpose(sale/rental = 고인텐트)를 받고도 미활용.
- Jobber 클릭 미추적 + UTM 캡처 없음 — 채널 ROI 측정 불가.
- 자산: 가격 캘리브레이션은 시장 정합, 실명 리뷰 5.0★/104.

## 전략

| 우선순위 | 전략 | 핵심 |
|---|---|---|
| P0 | lite 견적 공개 배포 + soft gate | 가격 먼저 → 결과 하단 "PDF/정확한 견적 원하면 이메일" 캡처. 광고 카피와 실경험 일치 |
| P0 | Warm lead 리마케팅 시퀀스 | booking 미클릭 리드에 T+30분 SMS → T+1일 이메일(PDF+리뷰) → T+3일 SMS. sale/rental은 즉시 알림. (5분 내 응답 시 전환 21배, SMS 응답률 45% vs 이메일 6%) |
| P1 | Suburb SEO 랜딩 | /painters/[suburb] — Manly·Dee Why·Mona Vale·Avalon·Freshwater. coastal salt air 카피 + 프리필 lite 폼 + JSON-LD |
| P1 | GBP 전환 엔진화 | "Get Quote" 액션 링크, 주간 before/after 게시물, job 완료 SMS에 리뷰 딥링크 |
| P1 | 측정 인프라 (광고 전 전제) | GA4+Pixel, UTM localStorage→리드 문서, Jobber 링크에 lead id 쿼리 |
| P2 | Google Search/LSA + Meta 리타게팅 | 측정 후 집행. 시작 $300-600/월. 광고는 반드시 lite 랜딩으로 (로그인 /estimate 금지) |
| P2 | 커뮤니티 + 부동산 에이전트 리퍼럴 | NB Mums·suburb FB 그룹·Nextdoor 가치 제공형 참여. sale/rental 세그먼트 ↔ agent 제휴 |

## KPI

랜딩→가격 확인률 / 리드 캡처율 / 리마케팅 회수율 / 채널별 CPL·CPA / speed-to-lead(목표 5분) / GBP 리뷰 velocity / suburb 랜딩 오가닉 성과.
