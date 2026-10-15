import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common'
import { Response } from 'express'

import { Auth, FormGuard } from '@decorator'
import { ExportSubmissionsDto } from '@dto'
import { flattenFields } from '@heyform-inc/answer-utils'
import { date } from '@heyform-inc/utils'
import { ExportFileService, FormService, SubmissionService } from '@service'

@Controller()
@Auth()
export class ExportSubmissionsController {
  constructor(
    private readonly submissionService: SubmissionService,
    private readonly formService: FormService,
    private readonly exportFileService: ExportFileService
  ) {}

  @Get('/api/export/submissions')
  @FormGuard()
  async exportSubmissions(
    @Query() input: ExportSubmissionsDto,
    @Res() res: Response
  ): Promise<void> {
    const form = await this.formService.findById(input.formId)
    if (!form) {
      throw new BadRequestException('The form does not exist')
    }

    const submissions = await this.submissionService.findAllByForm(input.formId)

    const data = await this.exportFileService.csv(
      flattenFields(form.fields),
      form.hiddenFields,
      submissions || []
    )
    const dateStr = date().format('YYYY-MM-DD')
    const safeFormName = (form.name || 'submissions').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_')
    const filename = `${safeFormName}-${dateStr}.csv`
    const encodedFilename = encodeURIComponent(filename)

    res.header('Content-Type', 'text/csv; charset=utf-8')
    res.header(
      'Content-Disposition',
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    )
    res.header('Access-Control-Expose-Headers', 'Content-Disposition')
    res.send('\uFEFF' + data)
  }
}
