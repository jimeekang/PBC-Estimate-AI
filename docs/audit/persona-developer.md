# 페르소나 전략 — 그로스 개발자 (계측·자동화·SEO 인프라)

## 진단 (grep 실측)

- analytics 0건 (gtag/GA4/PostHog/fbq 전부 부재) — 퍼널 어느 단계도 측정 불가.
- lead capture가 위저드 마지막 step + 그 앞에 signup+인증 장벽.
- 팔로업 인프라 0건 (nodemailer/sendgrid/resend/twilio 부재, Cloud Functions 트리거 없음). 사장 알림도 없음.
- 전환 전액이 계측 안 되는 단일 외부 링크(Jobber)에 의존.
- 로그인 유저는 랜딩(소셜프루프)을 못 봄 — PublicAuthRedirect 즉시 리다이렉트.
- SEO: 루트 메타/OG 양호. JSON-LD·sitemap·robots·per-page 메타 전무. A/B 인프라 0건.

## 전략

| 우선순위 | 전략 | 핵심 |
|---|---|---|
| P0 | GA4 퍼널 전 구간 계측 | @next/third-parties, CSP에 GA 도메인. 이벤트: landing_view→lite_start/complete→signup→verified→step_view(0~3)→generated→book_online_click→pdf_download |
| P0 | Firestore onCreate 알림+팔로업 | 사장 이메일/SMS + 고객 확인 메일(PDF) + T+1h/24h/72h nurture. 발송 인프라만 부재, 데이터는 이미 있음 |
| P0 | 공개 lite 라우트 부활 | page.tsx 생성 + CTA 재배선 + public-home-cta-copy.test.ts 단언 수정 |
| P1 | JSON-LD + sitemap/robots | LocalBusiness/AggregateRating(5.0★/104 실값)/Service. OG 이미지를 before/after로 |
| P1 | 리다이렉트 완화 + Jobber prefill | PublicAuthRedirect → "견적 계속하기" 배너. booking URL에 고객 정보 쿼리 prefill |
| P2 | A/B 인프라 + 성능 | PostHog flags(헤드라인·CTA 순서·lead 시점). Web Vitals CI 회귀 감시 |

## KPI

견적 시작률 / 위저드 스텝별 이탈률 / lead 캡처 수 / book_online_click률 / Jobber UTM 매칭 예약 수 / nurture 시퀀스 회수율 / 콜백 소요시간 / 로컬 키워드 오가닉·리치결과 / Core Web Vitals.
