import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

/* 메일 — 서비스용 Gmail 계정의 앱 비밀번호로 보낸다(도메인 없이, 하루 500통). 지금은 비밀번호 재설정 메일 하나.
   GMAIL_USER·GMAIL_APP_PASSWORD 가 없으면(로컬 개발) 보내지 않고 서버 로그에 내용을 찍는다 — 링크를 눌러 시험할 수 있게 */
@Injectable()
export class Mailer {
  private readonly log = new Logger('Mail');
  private readonly from?: string;
  private readonly smtp?: Transporter;

  constructor(config: ConfigService) {
    const user = config.get<string>('GMAIL_USER')?.trim();
    const pass = config.get<string>('GMAIL_APP_PASSWORD')?.replace(/\s/g, ''); // 구글이 4자씩 띄어 보여 준다
    if (!user || !pass) return;
    this.from = `cabinet <${user}>`;
    this.smtp = createTransport({ service: 'gmail', auth: { user, pass } });
  }

  async send(to: string, subject: string, text: string) {
    if (!this.smtp) return this.log.warn(`메일 설정 없음 — 보내는 대신 찍는다\n받는 이: ${to}\n${subject}\n${text}`);
    await this.smtp.sendMail({ from: this.from, to, subject, text });
  }
}
